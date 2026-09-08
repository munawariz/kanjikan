"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser-side Supabase client. One per tab is correct and intended. */
export function createClient() {
  if (!client) {
    const { url, key } = requireSupabaseEnv();
    client = createBrowserClient(url, key);
  }
  return client;
}
