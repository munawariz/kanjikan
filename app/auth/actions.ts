"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAccount, endSession, startSession, verifyLogin } from "@/lib/auth";
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  isValidUsername,
  normalizeUsername,
  passwordTooLong,
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

const UNREACHABLE = { error: "Could not reach the database. Try again in a moment." };

/**
 * One form for everyone. A username that exists is signed in; one that does
 * not comes back as confirmCreate, and the form resubmits with intent=create
 * once the user has agreed to open that account.
 *
 * redirect() works by throwing, so it is only ever called outside the
 * try/catch blocks that turn a database failure into a message.
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
  if (passwordTooLong(password)) {
    return { error: `Passwords can be at most ${PASSWORD_MAX_BYTES} characters.` };
  }

  if (formData.get("intent") === "create") {
    if (password.length < PASSWORD_MIN) {
      return { error: `Use at least ${PASSWORD_MIN} characters for your password.` };
    }
    try {
      // Keeps the capitalisation they typed for greetings; the login itself
      // is case-insensitive.
      const account = await createAccount(username, typed, password);
      if (!account) return { error: "That username was taken a moment ago. Choose another." };
      await startSession(account.id);
    } catch (e) {
      console.error(`[kanjikan] createAccount failed: ${(e as Error).message}`);
      return UNREACHABLE;
    }
    revalidatePath("/", "layout");
    redirect(next);
  }

  let result: Awaited<ReturnType<typeof verifyLogin>>;
  try {
    result = await verifyLogin(username, password);
    if (result.status === "ok") await startSession(result.id);
  } catch (e) {
    console.error(`[kanjikan] sign-in failed: ${(e as Error).message}`);
    return UNREACHABLE;
  }

  switch (result.status) {
    case "ok":
      revalidatePath("/", "layout");
      redirect(next);
    case "locked":
      return { error: "Too many wrong passwords for that username. Wait a few minutes and try again." };
    case "wrong-password":
      return { error: "Wrong password for that username." };
    case "no-account":
      if (password.length < PASSWORD_MIN) {
        return {
          error: `There is no account called ${username} yet. To open it, choose a password of at least ${PASSWORD_MIN} characters.`,
        };
      }
      return { confirmCreate: username };
  }
}

export async function signOut() {
  await endSession();
  revalidatePath("/", "layout");
  redirect("/login");
}
