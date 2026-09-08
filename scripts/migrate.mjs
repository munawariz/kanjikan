#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql to the database, in filename order.
 *
 * Connects straight to Postgres rather than going through PostgREST, because
 * PostgREST cannot run DDL - it only exposes tables that already exist. That is
 * why the anon/publishable key is not enough here and a real connection string
 * is needed.
 *
 * Applied files are recorded in public.schema_migrations, so running this twice
 * is a no-op and adding a new file only runs that file.
 *
 *   npm run migrate           apply anything not yet applied
 *   npm run migrate -- --redo re-run every file, ignoring the ledger
 *   npm run migrate -- --dry  list what would run, connect to nothing
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const LEDGER = "public.schema_migrations";

const argv = process.argv.slice(2);
const redo = argv.includes("--redo");
const dry = argv.includes("--dry");

/** Next.js loads .env.local over .env; mirror that order. */
function loadEnv() {
  const out = {};
  for (const file of [".env", ".env.local"]) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const connectionString = env.SUPABASE_DB_URL || env.DATABASE_URL || "";

const files = fs.existsSync(MIGRATIONS_DIR)
  ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()
  : [];

if (files.length === 0) {
  console.log("No .sql files in supabase/migrations/. Nothing to do.");
  process.exit(0);
}

if (dry) {
  console.log("Migrations on disk:");
  for (const f of files) console.log(`  ${f}`);
  process.exit(0);
}

if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set.\n");
  console.error("It is not the same as NEXT_PUBLIC_SUPABASE_URL. Get it from:");
  console.error("  Supabase dashboard > Connect > ORMs / Connection string > URI");
  console.error("Prefer the Session pooler URI: it is reachable over IPv4, whereas the");
  console.error("direct db.<ref>.supabase.co host is IPv6-only on newer projects.\n");
  console.error("Then add it to .env (already gitignored):");
  console.error("  SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres");
  process.exit(1);
}

/** Never let a password reach the terminal. */
function safeTarget(cs) {
  try {
    const u = new URL(cs);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(unparseable connection string)";
  }
}

const client = new pg.Client({
  connectionString,
  // Supabase terminates TLS with a certificate chain Node does not ship a root
  // for. The connection is still encrypted; only chain verification is relaxed.
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  application_name: "kanjikan-migrate",
});

console.log(`Connecting to ${safeTarget(connectionString)}`);

try {
  await client.connect();
} catch (e) {
  console.error(`\nCould not connect: ${e.message}\n`);
  if (/ENOTFOUND|EAI_AGAIN/.test(e.message)) {
    console.error("The host did not resolve. Check the URI was copied whole.");
  } else if (/ENETUNREACH|EHOSTUNREACH/.test(e.message)) {
    console.error("Unreachable - usually the IPv6-only direct connection. Use the");
    console.error("Session pooler URI from the same dialog instead.");
  } else if (/password|SASL|authentication/i.test(e.message)) {
    console.error("Authentication failed. Reset the database password in");
    console.error("Project Settings > Database and paste the new URI.");
  }
  process.exit(1);
}

let failed = false;
try {
  await client.query(
    `create table if not exists ${LEDGER} (
       name text primary key,
       applied_at timestamptz not null default now()
     )`,
  );

  const { rows } = await client.query(`select name from ${LEDGER}`);
  const applied = new Set(rows.map((r) => r.name));

  let ran = 0;
  console.log("");
  for (const file of files) {
    if (applied.has(file) && !redo) {
      console.log(`  ${file}  already applied`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      // One transaction per file: a migration either lands whole or not at all.
      // The whole file goes in a single query so dollar-quoted function bodies
      // are not chopped up by naive splitting on semicolons.
      await client.query("begin");
      await client.query(sql);
      await client.query(
        `insert into ${LEDGER} (name) values ($1)
         on conflict (name) do update set applied_at = now()`,
        [file],
      );
      await client.query("commit");
      console.log(`  ${file}  ${applied.has(file) ? "re-applied" : "applied"}`);
      ran++;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.error(`  ${file}  FAILED - rolled back`);
      console.error(`\n${e.message}`);
      if (e.position) console.error(`  at character ${e.position}`);
      failed = true;
      break;
    }
  }

  if (!failed) {
    console.log(ran === 0 ? "\nDatabase already up to date." : `\n${ran} migration(s) applied.`);
    console.log("Verify with: npm run doctor");
  }
} finally {
  await client.end().catch(() => {});
}

process.exit(failed ? 1 : 0);
