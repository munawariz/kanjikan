"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_NAMES, LOCALES } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";

/**
 * Language switch for a guest, who has no settings page. Steps to the next
 * language and re-renders; the choice is kept on this browser only.
 */
export function LanguageToggle() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length];

  async function toggle() {
    const res = await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => null);
    if (res?.ok) startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={t.shell.switchLanguage(LOCALE_NAMES[next])}
      title={LOCALE_NAMES[next]}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 38,
        height: 38,
        padding: "0 10px",
        flex: "0 0 auto",
        borderRadius: "var(--radius-full)",
        border: "1px solid var(--border-default)",
        background: "transparent",
        color: "var(--text-heading)",
        fontFamily: "var(--font-text)",
        fontSize: "var(--text-body-sm)",
        fontWeight: "var(--weight-semibold)",
        letterSpacing: "0.04em",
        cursor: pending ? "default" : "pointer",
        opacity: pending ? 0.6 : 1,
        transition: "var(--transition-control)",
      }}
    >
      {/* The language it switches to, the way a flag-free switch usually reads. */}
      {next.toUpperCase()}
    </button>
  );
}
