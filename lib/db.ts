import "server-only";
import pg from "pg";

/**
 * The one connection to Postgres.
 *
 * The app talks to the database directly — no Supabase Auth, no REST API — and
 * only ever from the server. SUPABASE_DB_URL is a server-side variable and
 * never reaches the browser.
 */

export const DATABASE_URL = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? "";

export const isDatabaseConfigured = Boolean(DATABASE_URL);

// Timestamps come back as ISO strings and dates as YYYY-MM-DD, the shapes the
// rest of the app already works in, rather than as Date objects.
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz
pg.types.setTypeParser(1082, (v) => v); // date

/**
 * One pool per server process. Kept on globalThis so that hot reloading in
 * development does not open a new pool on every edit.
 */
const globalForPool = globalThis as unknown as { kanjikanPool?: pg.Pool };

function pool(): pg.Pool {
  if (!isDatabaseConfigured) {
    throw new Error("SUPABASE_DB_URL is not set. See .env.example.");
  }
  globalForPool.kanjikanPool ??= new pg.Pool({
    connectionString: DATABASE_URL,
    // Supabase terminates TLS with a certificate chain Node does not ship a
    // root for. The connection is still encrypted; only chain verification is
    // relaxed — the same as scripts/migrate.mjs.
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    application_name: "kanjikan",
  });
  return globalForPool.kanjikanPool;
}

export type Db = Pick<pg.PoolClient, "query">;

/**
 * Runs `fn` in a transaction as one account.
 *
 * The transaction switches to the `authenticated` role and sets the claims
 * that make auth.uid() return this account's id, so every row level security
 * policy applies exactly as it would to a signed-in Supabase user: a query
 * that forgets to filter by user still cannot see anyone else's rows.
 */
export async function asUser<T>(userId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Runs `fn` in a transaction as the connection's own role, which row level
 * security does not restrict.
 *
 * Only for what happens before anyone is signed in — accounts and sessions —
 * and only from lib/auth.ts. Everything that belongs to a learner goes through
 * asUser.
 */
export async function asSystem<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
