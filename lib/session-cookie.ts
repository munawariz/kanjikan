/**
 * The session cookie's name, in a module of its own: the middleware needs it,
 * and the middleware must not import lib/auth, which brings the database
 * driver with it and cannot run where middleware runs.
 */
export const SESSION_COOKIE = "kanjikan_session";
