"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import { useLocale, useLocales, useT } from "@/lib/i18n/client";

const CONTROL: React.CSSProperties = {
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
  transition: "var(--transition-control)",
};

/**
 * Language switch for a guest, who has no settings page. The choice is kept
 * on this browser only.
 *
 * With two languages it is one button that steps to the other. With more it
 * is a list, since stepping through them one tap at a time would be a chore.
 * Either way the header shows only the code.
 */
export function LanguageToggle() {
  const t = useT();
  const locale = useLocale();
  const locales = useLocales();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (locales.length < 2) return null;

  async function choose(next: Locale) {
    const res = await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => null);
    if (res?.ok) startTransition(() => router.refresh());
  }

  const busy = { cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1 };

  if (locales.length > 2) {
    const name = locales.find((l) => l.code === locale)?.name ?? locale;
    // The native list, laid invisibly over a button-sized label: the header
    // keeps its compact code, and the list that opens shows full names.
    return (
      <span style={{ ...CONTROL, ...busy, position: "relative", gap: 4 }}>
        <span aria-hidden="true">{locale.toUpperCase()}</span>
        <select
          value={locale}
          disabled={pending}
          onChange={(e) => choose(e.target.value)}
          aria-label={t.shell.chooseLanguage(name)}
          title={name}
          style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "inherit" }}
        >
          {locales.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </span>
    );
  }

  const next = locales.find((l) => l.code !== locale) ?? locales[0];
  return (
    <button
      type="button"
      onClick={() => choose(next.code)}
      disabled={pending}
      aria-label={t.shell.switchLanguage(next.name)}
      title={next.name}
      style={{ ...CONTROL, ...busy }}
    >
      {/* The language it switches to, the way a flag-free switch usually reads. */}
      {next.code.toUpperCase()}
    </button>
  );
}
