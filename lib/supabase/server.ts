import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { requireSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * Must be created per request: it reads the caller cookies, so a module-level
 * singleton would leak one user session into another user request.
 */
export function createClient() {
  const { url, key } = requireSupabaseEnv();
  const cookieStore = cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The middleware refreshes the
          // session on every request, so dropping the write here is safe.
        }
      },
    },
  });
}

/**
 * The signed-in user, or null. Never throws for an anonymous visitor.
 *
 * Memoised per request: a layout and its page both ask, and each uncached
 * call is a round trip to the auth server.
 */
export const getUser = cache(async () => {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});
