"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import type { Kanji } from "@/lib/content";

export type KanjiEntry = Kanji & {
  words: { id: string; word: string; reading: string; meanings: string[]; lessonSlug: string }[];
  known: number;
};

/**
 * Kanji reference.
 *
 * Deliberately a reference rather than a drill: the app teaches words, and this
 * screen exists to answer "where else does this character turn up". Selecting a
 * character shows every N5 word built from it.
 */
export function KanjiExplorer({ entries }: { entries: KanjiEntry[] }) {
  const [selected, setSelected] = useState(entries[0]?.char ?? "");
  const active = entries.find((e) => e.char === selected) ?? entries[0];

  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
          gap: 8,
          alignContent: "start",
        }}
      >
        {entries.map((entry) => {
          const isActive = entry.char === selected;
          return (
            <button
              key={entry.char}
              type="button"
              onClick={() => setSelected(entry.char)}
              aria-pressed={isActive}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                aspectRatio: "1",
                border: `1px solid ${isActive ? "var(--border-strong)" : "var(--border-subtle)"}`,
                borderRadius: "var(--radius-sm)",
                background: isActive ? "var(--surface-inverse)" : "var(--surface-card)",
                color: isActive ? "var(--text-inverse)" : "var(--text-heading)",
                cursor: "pointer",
                transition: "var(--transition-control)",
              }}
            >
              <span className="jp" style={{ fontSize: 26, lineHeight: 1 }}>
                {entry.char}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: isActive ? "var(--lime-500)" : "var(--text-muted)",
                }}
              >
                {entry.known}/{entry.words.length}
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <div style={{ position: "sticky", top: 24, alignSelf: "start" }}>
          <Card tone="cream" pad="lg" radius="lg">
            <div className="stack" style={{ gap: 24 }}>
              <div className="row" style={{ gap: 20, alignItems: "flex-start" }}>
                <span className="jp-display" style={{ fontSize: 72, color: "var(--on-tint-heading)" }}>
                  {active.char}
                </span>
                <div className="stack" style={{ gap: 8, paddingTop: 6 }}>
                  <div
                    style={{
                      fontSize: "var(--text-heading-3)",
                      color: "var(--text-heading)",
                      lineHeight: 1.2,
                    }}
                  >
                    {active.meanings.join(", ")}
                  </div>
                  <Badge tone="sage">{active.strokes} strokes</Badge>
                </div>
              </div>

              <div className="stack" style={{ gap: 12 }}>
                {[
                  ["On", active.onyomi],
                  ["Kun", active.kunyomi],
                ].map(([label, readings]) => (
                  <div key={label as string} className="row" style={{ gap: 14, alignItems: "baseline" }}>
                    <span className="eyebrow" style={{ width: 36, color: "var(--on-tint-body)" }}>
                      {label as string}
                    </span>
                    <span className="jp" style={{ color: "var(--on-tint-heading)" }}>
                      {(readings as string[]).length ? (readings as string[]).join("・") : "—"}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ height: 1, background: "var(--border-default)" }} />

              <div className="stack" style={{ gap: 14 }}>
                <p className="eyebrow" style={{ color: "var(--on-tint-body)" }}>
                  {active.words.length} {active.words.length === 1 ? "word" : "words"} use it
                </p>

                <div className="stack" style={{ gap: 10, maxHeight: 340, overflowY: "auto" }}>
                  {active.words.map((w) => (
                    <Link
                      key={w.id}
                      href={`/lessons/${w.lessonSlug}`}
                      className="reset-link row"
                      style={{ gap: 14, justifyContent: "space-between" }}
                    >
                      <span className="jp" style={{ fontSize: 18, color: "var(--on-tint-heading)" }}>
                        {w.word}
                        <span style={{ color: "var(--on-tint-body)", fontSize: 14, marginLeft: 8 }}>
                          {w.reading}
                        </span>
                      </span>
                      <span
                        className="body-sm"
                        style={{ color: "var(--on-tint-body)", textAlign: "right" }}
                      >
                        {w.meanings[0]}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
