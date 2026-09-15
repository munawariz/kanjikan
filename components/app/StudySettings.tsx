"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
      Not saved. {error}
    </span>
  ) : saved && !pending ? (
    <span role="status" className="body-sm muted">
      Saved.
    </span>
  ) : null;

  return { save, working: busy || pending, status };
}

export const WRITING_OPTIONS = [
  {
    value: false,
    title: "Reading only",
    detail: "Recognise kanji and read the words. No drawing.",
  },
  {
    value: true,
    title: "Reading and writing",
    detail: "Also write each kanji from memory, reviewed on its own schedule.",
  },
];

/**
 * Whether writing is part of this learner's study. Switching keeps what is
 * already stored either way: turning writing off only stops it being asked
 * and shown, and turning it back on picks up where it was.
 */
export function WritingSetting({ initial }: { initial: boolean | null }) {
  const [value, setValue] = useState<boolean | null>(initial);
  const { save, working, status } = useSave();

  return (
    <div className="stack" style={{ gap: 10 }}>
      <Choice
        label="What you are learning"
        options={WRITING_OPTIONS}
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

const WARNING_OPTIONS: { value: number | null; title: string }[] = [
  { value: 10, title: "10 reviews" },
  { value: 20, title: "20 reviews" },
  { value: 50, title: "50 reviews" },
  { value: null, title: "Never" },
];

/** How many due reviews make a new lesson suggest reviewing first. */
export function ReviewWarningSetting({ initial }: { initial: number | null }) {
  const [value, setValue] = useState<number | null>(initial);
  const { save, working, status } = useSave();

  // A value set some other way still shows, rather than no option selected.
  const options = WARNING_OPTIONS.some((o) => o.value === value)
    ? WARNING_OPTIONS
    : [{ value, title: `${value} reviews` }, ...WARNING_OPTIONS];

  return (
    <div className="stack" style={{ gap: 10 }}>
      <Choice
        label="Warn before a new lesson at"
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
