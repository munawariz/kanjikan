/**
 * Accounts are identified by username alone, but Supabase Auth only does
 * password sign-in against an email or a phone number. Each username is
 * therefore stored as an address at a domain that can never receive mail:
 * .internal is reserved for private use and does not resolve publicly.
 *
 * The same domain is hard-coded in public.username_exists
 * (supabase/migrations/0003_usernames.sql). Change both or neither.
 */
export const USERNAME_DOMAIN = "kanjikan.internal";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const PASSWORD_MIN = 8;

/** Mirrored by the input's pattern attribute, which runs before lowercasing. */
const USERNAME_RE = new RegExp(`^[a-z0-9_-]{${USERNAME_MIN},${USERNAME_MAX}}$`);

/**
 * Usernames are case-insensitive, as the email they become is. "Rina" and
 * "rina" are the same account.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

export function usernameToEmail(username: string): string {
  return `${username}@${USERNAME_DOMAIN}`;
}
