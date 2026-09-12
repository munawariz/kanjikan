/**
 * Accounts are a username and a password, nothing else. The same pattern is
 * enforced by a check constraint on public.accounts.username.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const PASSWORD_MIN = 8;

/**
 * bcrypt only reads the first 72 bytes of a password. Anything past that
 * would be silently ignored, so it is refused instead.
 */
export const PASSWORD_MAX_BYTES = 72;

/** Mirrored by the input's pattern attribute, which runs before lowercasing. */
const USERNAME_RE = new RegExp(`^[a-z0-9_-]{${USERNAME_MIN},${USERNAME_MAX}}$`);

/** Usernames are case-insensitive: "Rina" and "rina" are the same account. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

export function passwordTooLong(password: string): boolean {
  return new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES;
}
