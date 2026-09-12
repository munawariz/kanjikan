import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { asSystem, isDatabaseConfigured } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Accounts are a username and a password — no email, anywhere.
 *
 * Sessions are random tokens in an httpOnly cookie. The database keeps only a
 * hash of each token, so reading the sessions table does not let anyone sign
 * in as anybody.
 */

const SESSION_DAYS = 60;

/** bcrypt's work factor. About a quarter of a second per check, on purpose. */
const BCRYPT_ROUNDS = 12;

/** Wrong passwords in a row before the username is locked for a while. */
const MAX_FAILED = 10;
const LOCK_MINUTES = 15;

export type SessionUser = { id: string; username: string };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * The signed-in account, or null. Never throws for an anonymous visitor.
 *
 * Memoised per request: a layout and its page both ask.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token || !isDatabaseConfigured) return null;
  try {
    return await asSystem(async (db) => {
      const { rows } = await db.query<SessionUser>(
        `select a.id, a.username
           from public.sessions s
           join public.accounts a on a.id = s.account_id
          where s.token_hash = $1 and s.expires_at > now()`,
        [hashToken(token)],
      );
      return rows[0] ?? null;
    });
  } catch (e) {
    console.error(`[kanjikan] getUser failed: ${(e as Error).message}`);
    return null;
  }
});

/** Starts a session and sets its cookie. Server actions only: it writes a cookie. */
export async function startSession(accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await asSystem((db) =>
    db.query(`insert into public.sessions (token_hash, account_id, expires_at) values ($1, $2, $3)`, [
      hashToken(token),
      accountId,
      expires.toISOString(),
    ]),
  );
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

/** Ends this browser's session, in the database and in the cookie. */
export async function endSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await asSystem((db) => db.query(`delete from public.sessions where token_hash = $1`, [hashToken(token)])).catch(
      (e) => console.error(`[kanjikan] endSession failed: ${(e as Error).message}`),
    );
  }
  cookies().delete(SESSION_COOKIE);
}

export type LoginResult =
  | { status: "ok"; id: string }
  | { status: "no-account" }
  | { status: "wrong-password" }
  | { status: "locked" };

/**
 * Checks a username and password.
 *
 * Telling "no such account" apart from "wrong password" is deliberate: the
 * form offers to create an account for a free username. The lock after
 * repeated failures is what keeps that from being a free guessing service.
 */
export async function verifyLogin(username: string, password: string): Promise<LoginResult> {
  const account = await asSystem(async (db) => {
    const { rows } = await db.query<{ id: string; password_hash: string; locked: boolean }>(
      `select id, password_hash, coalesce(locked_until > now(), false) as locked
         from public.accounts where username = $1`,
      [username],
    );
    return rows[0];
  });

  if (!account) return { status: "no-account" };
  if (account.locked) return { status: "locked" };

  if (await bcrypt.compare(password, account.password_hash)) {
    await asSystem((db) =>
      db.query(`update public.accounts set failed_attempts = 0, locked_until = null where id = $1`, [account.id]),
    );
    return { status: "ok", id: account.id };
  }

  await asSystem((db) =>
    db.query(
      `update public.accounts
          set failed_attempts = failed_attempts + 1,
              locked_until = case when failed_attempts + 1 >= $2
                                  then now() + make_interval(mins => $3) end
        where id = $1`,
      [account.id, MAX_FAILED, LOCK_MINUTES],
    ),
  );
  return { status: "wrong-password" };
}

/**
 * Opens an account and its profile together, so there is never an account
 * without one. Returns null if the username was taken in the meantime.
 */
export async function createAccount(
  username: string,
  displayName: string,
  password: string,
): Promise<{ id: string } | null> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return asSystem(async (db) => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.accounts (username, password_hash) values ($1, $2)
       on conflict (username) do nothing
       returning id`,
      [username, hash],
    );
    const account = rows[0];
    if (!account) return null;
    await db.query(`insert into public.profiles (id, display_name) values ($1, $2)`, [account.id, displayName]);
    return account;
  });
}
