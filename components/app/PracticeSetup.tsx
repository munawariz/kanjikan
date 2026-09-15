"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Icon } from "@/components/atlas/core/Icon.jsx";
import { isPracticeType, PRACTICE_TYPES, type PracticeType } from "@/lib/study";

/** One JLPT level as the practice page offers it. */
export type PracticeLevel = {
  level: string;
  title: string;
  /** Built and in the app. A level that is not is shown, and cannot be picked. */
  available: boolean;
  /** In curriculum order. Empty for a level that is not available. */
  kanji: { char: string; meaning: string }[];
};

const TYPE_OPTIONS: {
  type: PracticeType | "hearing";
  label: string;
  body: string;
  icon: string;
}[] = [
  {
    type: "reading",
    label: "Reading",
    body: "What each kanji means, and how the words it teaches are read.",
    icon: "book-open",
  },
  {
    type: "writing",
    label: "Writing",
    body: "Write each kanji from memory. Every stroke is checked.",
    icon: "pen-line",
  },
  {
    type: "hearing",
    label: "Hearing",
    body: "Pick the word you hear.",
    icon: "volume-2",
  },
];

/**
 * The practice page: choose the kanji, choose what to drill, start.
 *
 * Kanji can be picked one at a time or a whole level at once, and the two mix:
 * all of N5 plus a few from N4 is a fair thing to want. The choices travel to
 * the session in the URL, which is also how "Change Practice" at the end of a
 * run comes back here with them already made.
 */
export function PracticeSetup({
  levels,
  initialKanji,
  initialLevels,
  initialTypes,
}: {
  levels: PracticeLevel[];
  initialKanji: string;
  initialLevels: string;
  initialTypes: string;
}) {
  const router = useRouter();
  const available = levels.filter((l) => l.available);

  const [picks, setPicks] = useState<Set<string>>(() => {
    const fromLevels = new Set(initialLevels.split(","));
    return new Set(
      available.flatMap((l) =>
        l.kanji.filter((k) => fromLevels.has(l.level) || initialKanji.includes(k.char)).map((k) => k.char),
      ),
    );
  });
  const [types, setTypes] = useState<Set<PracticeType>>(() => {
    const chosen = initialTypes.split(",").filter(isPracticeType);
    return new Set(chosen.length ? chosen : ["reading"]);
  });

  function toggle(char: string) {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(char)) next.delete(char);
      else next.add(char);
      return next;
    });
  }

  /** Picks the whole level, or, when it is already all picked, drops it. */
  function toggleLevel(level: PracticeLevel) {
    setPicks((prev) => {
      const next = new Set(prev);
      const all = level.kanji.every((k) => next.has(k.char));
      for (const k of level.kanji) {
        if (all) next.delete(k.char);
        else next.add(k.char);
      }
      return next;
    });
  }

  function toggleType(type: PracticeType) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const chosenTypes = PRACTICE_TYPES.filter((t) => types.has(t));
  const ready = picks.size > 0 && chosenTypes.length > 0;

  /**
   * A whole level goes by name rather than character by character, so the
   * address stays short once a level has a thousand kanji in it.
   */
  function start() {
    const whole = available.filter((l) => l.kanji.every((k) => picks.has(k.char)));
    const wholeChars = new Set(whole.flatMap((l) => l.kanji.map((k) => k.char)));
    const single = available
      .flatMap((l) => l.kanji)
      .filter((k) => picks.has(k.char) && !wholeChars.has(k.char))
      .map((k) => k.char)
      .join("");
    const query = new URLSearchParams();
    if (whole.length) query.set("levels", whole.map((l) => l.level).join(","));
    if (single) query.set("kanji", single);
    query.set("types", chosenTypes.join(","));
    router.push(`/practice/session?${query}`);
  }

  const summary =
    picks.size === 0
      ? "Pick at least one kanji."
      : chosenTypes.length === 0
        ? "Choose what to practise."
        : `${picks.size} kanji · ${chosenTypes.map((t) => t[0].toUpperCase() + t.slice(1)).join(" and ")}`;

  return (
    <div className="stack" style={{ gap: 36 }}>
      <section className="stack" style={{ gap: 18 }} aria-labelledby="practice-kanji">
        <StepHeading n={1} id="practice-kanji" title="Choose kanji" />

        <div className="stack" style={{ gap: 10 }}>
          <span className="body-sm muted">A whole level</span>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {levels.map((l) => {
              const picked = l.kanji.filter((k) => picks.has(k.char)).length;
              const all = l.available && picked === l.kanji.length;
              return (
                <button
                  key={l.level}
                  type="button"
                  onClick={() => toggleLevel(l)}
                  disabled={!l.available}
                  aria-pressed={l.available ? all : undefined}
                  title={l.available ? `${l.title}: ${l.kanji.length} kanji` : `${l.level} is coming later`}
                  className="stack"
                  style={{
                    gap: 2,
                    minWidth: 104,
                    padding: "10px 14px",
                    textAlign: "left",
                    borderRadius: "var(--radius-md)",
                    border: `1px ${l.available ? "solid" : "dashed"} ${
                      all || picked > 0 ? "var(--border-strong)" : "var(--border-default)"
                    }`,
                    background: all ? "var(--surface-inverse)" : "var(--surface-card)",
                    color: all ? "var(--text-inverse)" : l.available ? "var(--text-heading)" : "var(--text-muted)",
                    cursor: l.available ? "pointer" : "not-allowed",
                    transition: "var(--transition-control)",
                  }}
                >
                  <span className="row" style={{ gap: 6, fontWeight: "var(--weight-bold)" }}>
                    {all && <Icon name="check" size={14} />}
                    {l.level}
                  </span>
                  <span className="body-sm" style={{ color: all ? "var(--text-inverse-muted)" : "var(--text-muted)" }}>
                    {!l.available
                      ? "Coming later"
                      : picked > 0 && !all
                        ? `${picked} of ${l.kanji.length}`
                        : `${l.kanji.length} kanji`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {available.map((l) => (
          <div key={l.level} className="stack" style={{ gap: 10 }}>
            <span className="body-sm muted">Or single kanji from {l.level}</span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
                gap: 8,
              }}
            >
              {l.kanji.map((k) => {
                const on = picks.has(k.char);
                return (
                  <button
                    key={k.char}
                    type="button"
                    onClick={() => toggle(k.char)}
                    aria-pressed={on}
                    aria-label={`${k.char}, ${k.meaning}`}
                    title={k.meaning}
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      aspectRatio: "1",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${on ? "var(--border-strong)" : "var(--border-subtle)"}`,
                      background: on ? "var(--surface-inverse)" : "var(--surface-card)",
                      color: on ? "var(--text-inverse)" : "var(--text-heading)",
                      cursor: "pointer",
                      transition: "var(--transition-control)",
                    }}
                  >
                    {on && (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          top: 3,
                          right: 3,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 15,
                          height: 15,
                          borderRadius: "var(--radius-full)",
                          background: "var(--lime-500)",
                          color: "var(--forest-800)",
                        }}
                      >
                        <Icon name="check" size={10} />
                      </span>
                    )}
                    <span className="jp" style={{ fontSize: 24, lineHeight: 1 }}>
                      {k.char}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="stack" style={{ gap: 18 }} aria-labelledby="practice-types">
        <StepHeading n={2} id="practice-types" title="Choose what to practise" note="Pick one or more." />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {TYPE_OPTIONS.map((option) => {
            const soon = option.type === "hearing";
            const on = !soon && types.has(option.type as PracticeType);
            return (
              <button
                key={option.type}
                type="button"
                onClick={soon ? undefined : () => toggleType(option.type as PracticeType)}
                disabled={soon}
                aria-pressed={soon ? undefined : on}
                className="stack"
                style={{
                  gap: 10,
                  padding: 16,
                  textAlign: "left",
                  borderRadius: "var(--radius-md)",
                  border: `1px ${soon ? "dashed" : "solid"} ${on ? "var(--border-strong)" : "var(--border-default)"}`,
                  background: on ? "var(--surface-card-sage)" : "var(--surface-card)",
                  color: soon ? "var(--text-muted)" : "var(--text-heading)",
                  cursor: soon ? "not-allowed" : "pointer",
                  transition: "var(--transition-control)",
                }}
              >
                <span className="row" style={{ justifyContent: "space-between", gap: 8, width: "100%" }}>
                  <span className="row" style={{ gap: 8, fontWeight: "var(--weight-semibold)" }}>
                    <Icon name={option.icon} size={18} />
                    {option.label}
                  </span>
                  {soon ? (
                    <Badge tone="sage">Coming later</Badge>
                  ) : (
                    // A checkbox's look, since more than one can be on.
                    <span
                      aria-hidden
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        border: `1.5px solid ${on ? "var(--forest-800)" : "var(--border-default)"}`,
                        background: on ? "var(--forest-800)" : "transparent",
                        color: "var(--lime-500)",
                      }}
                    >
                      {on && <Icon name="check" size={13} />}
                    </span>
                  )}
                </span>
                <span className="body-sm" style={{ color: soon ? "var(--text-muted)" : "var(--text-body)" }}>
                  {option.body}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pinned to the bottom of the screen, above the tab bar on a phone, so
          the run can be started from anywhere on a page with hundreds of
          tiles on it. */}
      <div
        className="row"
        style={{
          position: "sticky",
          bottom: "calc(var(--nav-tab-h, 0px) + env(safe-area-inset-bottom, 0px) + 12px)",
          zIndex: 5,
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          background: "var(--surface-card)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <span
          className="body-sm"
          aria-live="polite"
          style={{ color: ready ? "var(--text-heading)" : "var(--text-muted)", fontWeight: "var(--weight-semibold)" }}
        >
          {summary}
        </span>
        <div className="row" style={{ gap: 8 }}>
          {picks.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setPicks(new Set())}>
              Clear
            </Button>
          )}
          <Button variant="primary" size="sm" icon="chevron-right" disabled={!ready} onClick={start}>
            Start Practice
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepHeading({ n, id, title, note }: { n: number; id: string; title: string; note?: string }) {
  return (
    <div className="row" style={{ gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 26,
          height: 26,
          borderRadius: "var(--radius-full)",
          background: "var(--surface-inverse)",
          color: "var(--text-inverse)",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          alignSelf: "center",
        }}
      >
        {n}
      </span>
      <h2 id={id} style={{ margin: 0, fontSize: "var(--text-heading-3)", color: "var(--text-heading)" }}>
        {title}
      </h2>
      {note && <span className="body-sm muted">{note}</span>}
    </div>
  );
}
