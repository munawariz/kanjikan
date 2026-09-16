"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import { useLocales, useT } from "@/lib/i18n/client";
import { post } from "./StudySession";

/**
 * One choice among a few, each with a line of explanation. A radio group
 * rather than a switch because each option needs its consequence spelled out,
 * and a bare on/off says nothing about what either side means.
 */
function Choice<T extends string | number | boolean | null>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: T; title: string; detail?: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => !selected && onChange(o.value)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 4,
              padding: "14px 16px",
              textAlign: "left",
              border: `1px solid ${selected ? "var(--border-strong)" : "var(--border-default)"}`,
              borderRadius: "var(--radius-input)",
              background: selected ? "var(--surface-sunken)" : "var(--surface-card)",
              boxShadow: selected ? "inset 0 0 0 1px var(--border-strong)" : "none",
              color: "var(--text-heading)",
              fontFamily: "var(--font-text)",
              cursor: disabled ? "default" : "pointer",
              transition: "var(--transition-control)",
            }}
          >
            <span style={{ fontWeight: "var(--weight-semibold)", fontSize: "var(--text-body-sm)" }}>{o.title}</span>
            {o.detail && (
              <span className="body-sm" style={{ color: "var(--text-body)" }}>
                {o.detail}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Saves one setting, then refreshes so the nav badge and every figure follow it. */
function useSave() {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const ok = await post("/api/settings", body, setError);
    setBusy(false);
    if (ok) {
      setSaved(true);
      startTransition(() => router.refresh());
    }
    return ok;
  }

  const status = error ? (
    <span role="alert" className="body-sm" style={{ color: "var(--negative-600)" }}>
      {t.settings.notSaved} {error}
    </span>
  ) : saved && !pending ? (
    <span role="status" className="body-sm muted">
      {t.settings.saved}
    </span>
  ) : null;

  return { save, working: busy || pending, status };
}

/**
 * The language the app is shown in. Saving refreshes the page, which is what
 * switches it: the server renders in the saved language from then on.
 */
export function LanguageSetting({ initial }: { initial: Locale }) {
  const t = useT();
  const locales = useLocales();
  const [value, setValue] = useState<Locale>(initial);
  const { save, working, status } = useSave();

  return (
    <div className="stack" style={{ gap: 10 }}>
      <Choice
        label={t.settings.language.label}
        options={locales.map((l) => ({ value: l.code, title: l.name }))}
        value={value}
        onChange={async (next) => {
          const before = value;
          setValue(next);
          if (!(await save({ locale: next }))) setValue(before);
        }}
        disabled={working}
      />
      {status}
    </div>
  );
}

/**
 * Whether writing is part of this learner's study. Switching keeps what is
 * already stored either way: turning writing off only stops it being asked
 * and shown, and turning it back on picks up where it was.
 */
export function WritingSetting({ initial }: { initial: boolean | null }) {
  const t = useT();
  const [value, setValue] = useState<boolean | null>(initial);
  const { save, working, status } = useSave();

  return (
    <div className="stack" style={{ gap: 10 }}>
      <Choice
        label={t.settings.writing.label}
        options={[
          {
            value: false,
            title: t.settings.writing.readingOnly,
            detail: t.settings.writing.readingOnlyDetail,
          },
          {
            value: true,
            title: t.settings.writing.readingAndWriting,
            detail: t.settings.writing.readingAndWritingDetail,
          },
        ]}
        // Unchosen reads as writing on, which is what it means until chosen.
        value={value ?? true}
        onChange={async (next) => {
          const before = value;
          setValue(next);
          if (!(await save({ studyWriting: next }))) setValue(before);
        }}
        disabled={working}
      />
      {status}
    </div>
  );
}

const WARNING_VALUES = [10, 20, 50, null];

/** How many due reviews make a new lesson suggest reviewing first. */
export function ReviewWarningSetting({ initial }: { initial: number | null }) {
  const t = useT();
  const [value, setValue] = useState<number | null>(initial);
  const { save, working, status } = useSave();

  // A value set some other way still shows, rather than no option selected.
  const values = WARNING_VALUES.includes(value) ? WARNING_VALUES : [value, ...WARNING_VALUES];
  const options = values.map((v) => ({
    value: v,
    title: v === null ? t.settings.warning.never : t.settings.warning.reviews(v),
  }));

  return (
    <div className="stack" style={{ gap: 10 }}>
      <Choice
        label={t.settings.warning.label}
        options={options}
        value={value}
        onChange={async (next) => {
          const before = value;
          setValue(next);
          if (!(await save({ reviewWarning: next }))) setValue(before);
        }}
        disabled={working}
      />
      {status}
    </div>
  );
}
