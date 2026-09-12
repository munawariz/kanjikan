#!/usr/bin/env node
/**
 * Checks that the Supabase side of the app is actually set up.
 *
 * Progress writes are fire-and-forget so the UI never surfaces a failure; this
 * asks the database directly instead of guessing. It prints no secrets - only
 * whether each variable is present and what the API says about each table.
 *
 * Run: npm run doctor
 */
import fs from "node:fs";
import path from "node:path";

const TABLES = [
  "profiles",
  "word_progress",
  "lesson_progress",
  "study_sessions",
  "kanji_progress",
  "daily_quiz_answers",
];

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

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

console.log("Environment");
console.log(`  NEXT_PUBLIC_SUPABASE_URL       ${url ? "set (" + url.replace(/^https:\/\//, "").slice(0, 24) + "...)" : "MISSING"}`);
console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY  ${key ? "set (" + key.length + " chars)" : "MISSING"}`);

if (!url || !key) {
  console.log("\nBoth variables must be set in .env or .env.local. Nothing else can be checked.");
  process.exit(1);
}

let problems = 0;

const keyKind = key.startsWith("sb_publishable_")
  ? "publishable (new format)"
  : key.startsWith("eyJ")
    ? "anon JWT (legacy format)"
    : "UNRECOGNISED";
console.log(`  key format                     ${keyKind}`);
if (keyKind === "UNRECOGNISED") {
  problems++;
  console.log("    -> Expected sb_publishable_... or a JWT starting eyJ. Re-copy the");
  console.log("       publishable/anon key from Project Settings > API.");
}

// Deliberately not the /rest/v1/ root: that endpoint rejects publishable keys
// with 401 "Secret API key required" even when everything is configured
// correctly, so using it as a health check reports a false failure.
console.log("\nReachability");
try {
  const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
  console.log(`  Auth service                   HTTP ${res.status}${res.ok ? " OK" : ""}`);
  if (!res.ok) {
    problems++;
    console.log("    -> Project URL or key is wrong, or the project is paused.");
  }
} catch (e) {
  problems++;
  console.log(`  Auth service                   UNREACHABLE (${e.message})`);
  console.log("    -> Check the project URL, and that the project is not paused.");
}

// Accounts are usernames at an address that cannot receive mail, so with
// Confirm email on, every new account would wait forever for a link.
try {
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  const settings = res.ok ? await res.json() : null;
  if (!settings) {
    problems++;
    console.log(`  Auth settings                  HTTP ${res.status}`);
  } else if (settings.disable_signup) {
    problems++;
    console.log("  New accounts                   DISABLED");
    console.log("    -> Allow new users to sign up under Authentication > Sign In / Providers.");
  } else if (!settings.mailer_autoconfirm) {
    problems++;
    console.log("  Confirm email                  ON");
    console.log("    -> Switch it off under Authentication > Providers > Email, or no new");
    console.log("       account can be opened.");
  } else {
    console.log("  Confirm email                  off OK");
  }
} catch (e) {
  problems++;
  console.log(`  Auth settings                  ERROR ${e.message}`);
}

console.log("\nTables");
for (const table of TABLES) {
  let line = `  ${table.padEnd(30)} `;
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const body = await res.text();

    if (res.ok) {
      // RLS correctly returns an empty array to an anonymous caller.
      line += "OK (exists, RLS active)";
    } else if (res.status === 404 || body.includes("PGRST205") || body.includes("does not exist")) {
      problems++;
      line += "MISSING";
    } else {
      problems++;
      line += `HTTP ${res.status} ${body.slice(0, 90)}`;
    }
  } catch (e) {
    problems++;
    line += `ERROR ${e.message}`;
  }
  console.log(line);
}

console.log("\nFunctions");
{
  let line = `  ${"username_exists".padEnd(30)} `;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/username_exists`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_username: "doctor" }),
    });
    const body = await res.text();
    if (res.ok) {
      line += "OK";
    } else {
      problems++;
      line += res.status === 404 || body.includes("PGRST202") ? "MISSING" : `HTTP ${res.status} ${body.slice(0, 90)}`;
    }
  } catch (e) {
    problems++;
    line += `ERROR ${e.message}`;
  }
  console.log(line);
}

console.log("");
if (problems === 0) {
  console.log("Database looks correct. If progress still is not saving, the problem is in the");
  console.log("browser: open DevTools > Network and look at the POST to /api/answer.");
} else {
  console.log(`${problems} problem(s) found.`);
  console.log("If tables or functions are MISSING, run:  npm run migrate");
  console.log("That applies supabase/migrations/, creating the tables, the RLS policies,");
  console.log("the profile trigger and the username lookup. It needs SUPABASE_DB_URL in .env - see");
  console.log(".env.example for where to find it.");
}
process.exit(problems ? 1 : 0);
