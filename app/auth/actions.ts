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
import { cookies } from "next/headers";
import { getLocale, getT, rememberLocale } from "@/lib/i18n/server";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

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
 *
 * redirect() works by throwing, so it is only ever called outside the
 * try/catch blocks that turn a database failure into a message.
 */
export async function authenticate(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const typed = String(formData.get("username") ?? "").trim();
  const username = normalizeUsername(typed);
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/dashboard"));
  const t = (await getT()).auth.errors;
  const UNREACHABLE = { error: t.unreachable };

  if (!username || !password) {
    return { error: t.missing };
  }
  if (!isValidUsername(username)) {
    return { error: t.badUsername(USERNAME_MIN, USERNAME_MAX) };
  }
  if (passwordTooLong(password)) {
    return { error: t.passwordTooLong(PASSWORD_MAX_BYTES) };
  }

  if (formData.get("intent") === "create") {
    if (password.length < PASSWORD_MIN) {
      return { error: t.passwordTooShort(PASSWORD_MIN) };
    }
    try {
      // Keeps the capitalisation they typed for greetings; the login itself
      // is case-insensitive.
      // A language picked before signing up becomes the account's own.
      const picked = cookies().get(LOCALE_COOKIE)?.value;
      const account = await createAccount(username, typed, password, isLocale(picked) ? picked : null);
      if (!account) return { error: t.taken };
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
      return { error: t.locked };
    case "wrong-password":
      return { error: t.wrongPassword };
    case "no-account":
      if (password.length < PASSWORD_MIN) {
        return { error: t.noAccount(username, PASSWORD_MIN) };
      }
      return { confirmCreate: username };
  }
}

export async function signOut() {
  // Keeps the sign-in page in the language the learner was using.
  rememberLocale(await getLocale());
  await endSession();
  revalidatePath("/", "layout");
  redirect("/login");
}
