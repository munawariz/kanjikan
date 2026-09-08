"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; notice?: string };

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    displayName: String(formData.get("display_name") ?? "").trim(),
    next: String(formData.get("next") ?? "/dashboard"),
  };
}

/**
 * Only same-origin paths are accepted as a post-login destination, so a crafted
 * ?next=https://elsewhere cannot turn the login form into an open redirect.
 */
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, next } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase does not distinguish a wrong password from an unknown account,
    // and neither should the message.
    return { error: "That email and password do not match an account." };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(next));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, displayName } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  if (password.length < 8) {
    return { error: "Use at least 8 characters for your password." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || email.split("@")[0] } },
  });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation switched on, signUp returns a user but no session.
  // Say so rather than redirecting to a page that will bounce straight back.
  if (!data.session) {
    return { notice: "Check your email for a confirmation link, then sign in." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
