"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
} from "@/lib/username";

export type AuthState = {
  error?: string;
  /** Set when the username is free. The form asks before creating it. */
  confirmCreate?: string;
};

/**
 * Only same-origin paths are accepted as a post-login destination, so a crafted
 * ?next=https://elsewhere cannot turn the login form into an open redirect.
 */
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

/**
 * One form for everyone. A username that exists is signed in; one that does
 * not comes back as confirmCreate, and the form resubmits with intent=create
 * once the user has agreed to open that account.
 */
export async function authenticate(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const typed = String(formData.get("username") ?? "").trim();
  const username = normalizeUsername(typed);
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/dashboard"));

  if (!username || !password) {
    return { error: "Enter a username and password." };
  }
  if (!isValidUsername(username)) {
    return {
      error: `Usernames are ${USERNAME_MIN} to ${USERNAME_MAX} letters, numbers, underscores or hyphens.`,
    };
  }

  const supabase = createClient();
  const email = usernameToEmail(username);

  if (formData.get("intent") === "create") {
    if (password.length < PASSWORD_MIN) {
      return { error: `Use at least ${PASSWORD_MIN} characters for your password.` };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Keeps the capitalisation they typed for greetings; the login itself is
      // case-insensitive.
      options: { data: { display_name: typed } },
    });

    if (error) {
      if (error.code === "user_already_exists") {
        return { error: "That username was taken a moment ago. Choose another." };
      }
      return { error: error.message };
    }

    // With Confirm email on, Supabase holds the account until a link is
    // clicked, and the link goes to an address that cannot receive mail.
    if (!data.session) {
      return {
        error:
          "New accounts cannot be opened yet: switch off Confirm email in Supabase " +
          "(Authentication, Providers, Email).",
      };
    }

    revalidatePath("/", "layout");
    redirect(next);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (!error) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  // Rate limiting or an outage says nothing about whether the username is
  // free, so only a credentials mismatch may lead to the create prompt.
  if (error.code !== "invalid_credentials") {
    return { error: "Could not sign in right now. Try again in a moment." };
  }

  const { data: exists, error: lookupError } = await supabase.rpc("username_exists", {
    p_username: username,
  });

  if (lookupError) {
    return { error: "Could not check that username. Try again in a moment." };
  }
  if (exists) {
    return { error: "Wrong password for that username." };
  }
  if (password.length < PASSWORD_MIN) {
    return {
      error: `There is no account called ${username} yet. To open it, choose a password of at least ${PASSWORD_MIN} characters.`,
    };
  }

  return { confirmCreate: username };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
