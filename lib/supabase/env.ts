/**
 * Supabase connection details.
 *
 * Read through helpers rather than inline so a missing variable fails with a
 * sentence that says what to do, instead of surfacing later as an opaque
 * "Invalid URL" from deep inside the client.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when the app has enough configuration to talk to Supabase at all. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function requireSupabaseEnv(): { url: string; key: string } {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
}
