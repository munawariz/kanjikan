#!/usr/bin/env node
/**
 * Checks that the database side of the app is actually set up.
 *
 * Connects with SUPABASE_DB_URL, the same connection the app uses, and asks
 * Postgres directly rather than guessing. It prints no secrets - only whether
 * the variable is present, where it points, and what the database says.
 *
 * Run: npm run doctor
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const TABLES = [
  "accounts",
  "sessions",
  "profiles",
  "word_progress",
  "kanji_progress",
  "lesson_progress",
  "study_sessions",
  "daily_quiz_answers",
];

/** Readable only by the server. Nothing may be granted on them to the API roles. */
const PRIVATE_TABLES = ["accounts", "sessions"];

/** Next.js loads .env.local over .env; mirror that order here. */
function loadEnv() {
  const out = {};
  for (const file of [".env", ".env.local"]) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const connectionString = env.SUPABASE_DB_URL || env.DATABASE_URL || "";

function safeTarget(cs) {
  try {
    const u = new URL(cs);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(unparseable)";
  }
}

console.log("Environment");
console.log(`  SUPABASE_DB_URL   ${connectionString ? `set (${safeTarget(connectionString)})` : "MISSING"}`);
if (!connectionString) {
  console.log("\nSet SUPABASE_DB_URL in .env - see .env.example. Nothing else can be checked.");
  process.exit(1);
}

let problems = 0;
const fail = (line, hint) => {
  problems++;
  console.log(line);
  if (hint) console.log(`    -> ${hint}`);
};

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
try {
  await client.connect();
  console.log("  connection        OK");
} catch (e) {
  fail(`  connection        FAILED (${e.message})`, "Check the URI, and that the project is not paused.");
  process.exit(1);
}

try {
  await client.query("begin read only");

  console.log("\nTables");
  const { rows: present } = await client.query(
    `select c.relname, c.relrowsecurity
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname = any($1)`,
    [TABLES],
  );
  const byName = new Map(present.map((r) => [r.relname, r]));
  for (const t of TABLES) {
    const r = byName.get(t);
    if (!r) fail(`  ${t.padEnd(20)} MISSING`, "Run npm run migrate.");
    else if (!r.relrowsecurity) fail(`  ${t.padEnd(20)} row level security OFF`, "Run npm run migrate.");
    else console.log(`  ${t.padEnd(20)} OK (row level security on)`);
  }

  console.log("\nAccess");
  // The app runs every learner's query as this role; without membership it
  // cannot, and row level security would have nothing to scope by.
  const { rows: [role] } = await client.query(
    `select pg_has_role(current_user, 'authenticated', 'member') as ok`,
  );
  if (role.ok) console.log("  can act as a learner (role authenticated)  OK");
  else fail("  can act as a learner (role authenticated)  NO", "The connection must be the postgres user from the Connect dialog.");

  const { rows: grants } = await client.query(
    `select table_name, grantee from information_schema.role_table_grants
      where table_schema = 'public' and table_name = any($1) and grantee in ('anon', 'authenticated')`,
    [PRIVATE_TABLES],
  );
  if (grants.length === 0) console.log("  accounts and sessions closed to the API   OK");
  else fail(`  accounts and sessions closed to the API   NO (${grants.map((g) => `${g.table_name}:${g.grantee}`).join(", ")})`, "Run npm run migrate.");

  const { rows: [legacy] } = await client.query(
    `select count(*)::int as n from pg_constraint
      where contype = 'f' and connamespace = 'public'::regnamespace and confrelid = 'auth.users'::regclass`,
  ).catch(() => ({ rows: [{ n: 0 }] }));
  if (legacy.n === 0) console.log("  nothing depends on Supabase Auth          OK");
  else fail(`  nothing depends on Supabase Auth          NO (${legacy.n} foreign keys)`, "Run npm run migrate.");

  await client.query("rollback");
} finally {
  await client.end().catch(() => {});
}

console.log("");
if (problems === 0) {
  console.log("Database looks correct. If progress still is not saving, the problem is in the");
  console.log("browser: open DevTools > Network and look at the POST to /api/answer.");
} else {
  console.log(`${problems} problem(s) found. Most are fixed by: npm run migrate`);
}
process.exit(problems ? 1 : 0);
