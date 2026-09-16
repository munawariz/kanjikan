"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import type { Kanji, Level } from "@/lib/content";
import { useT } from "@/lib/i18n/client";
import type { KanjiReading, MarkState } from "@/lib/srs";
import { KanjiAnatomy } from "./KanjiAnatomy";
import { MarkControl } from "./MarkControl";
import { StrokeDiagram } from "./StrokeDiagram";

export type KanjiEntry = Pick<Kanji, "parts" | "radicalPart" | "mnemonic" | "usedIn"> & {
  char: string;
  strokes: number;
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
  radical: string | null;
  strokePaths: string[];
  level: Level;
  lessonOrder: number;
  lessonSlug: string;
  lessonTitle: string;
  /** How well it can be read, from its words. Known or past it tints the tile. */
  reading: KanjiReading;
  readingMarks: MarkState;
  /** False whenever the learner does not study writing. */
  canWrite: boolean;
  /** Null when the learner does not study writing. */
  writingMarks: MarkState | null;
  words: { id: string; word: string; reading: string; meanings: string[] }[];
};

/**
 * The full character set, in curriculum order, one block of tiles per level.
 *
 * Selecting a tile shows the character at size with its stroke order, readings,
 * radical, and the words that teach it. This is the reference half of the app;
 * the lessons are where the work happens.
 */
export function KanjiExplorer({ entries, viewBox }: { entries: KanjiEntry[]; viewBox: string }) {
  const t = useT();
  const x = t.kanji.explorer;
  const [selected, setSelected] = useState(entries[0]?.char ?? "");
  const active = entries.find((e) => e.char === selected) ?? entries[0];
  const detailRef = useRef<HTMLDivElement | null>(null);
  const levels = [...new Set(entries.map((e) => e.level))];

  /**
   * Below 860px the detail panel stacks underneath hundreds of tiles, so
   * choosing a character would otherwise update something entirely off screen.
   * Scrolling to it is the difference between the page working and appearing
   * not to respond at all.
   */
  function select(char: string) {
    setSelected(char);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches) {
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }

  return (
    <div className="grid grid-split" style={{ gap: 24 }}>
      <div className="stack" style={{ gap: 28, alignContent: "start" }}>
        {levels.map((level) => (
          <section key={level} className="stack" style={{ gap: 12 }}>
            {levels.length > 1 && (
              <p className="eyebrow">
                {x.levelCount(level, entries.filter((e) => e.level === level).length)}
              </p>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
                gap: 8,
                alignContent: "start",
              }}
            >
              {entries
                .filter((e) => e.level === level)
                .map((entry) => {
                  const isActive = entry.char === selected;
                  const known = entry.reading.band === "known" || entry.reading.band === "mastered";
                  return (
                    <button
                      key={entry.char}
                      type="button"
                      onClick={() => select(entry.char)}
                      aria-pressed={isActive}
                      title={entry.meanings.join(", ")}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        aspectRatio: "1",
                        border: `1px solid ${isActive ? "var(--border-strong)" : "var(--border-subtle)"}`,
                        borderRadius: "var(--radius-sm)",
                        background: isActive
                          ? "var(--surface-inverse)"
                          : known
                            ? "var(--surface-card-sage)"
                            : "var(--surface-card)",
                        color: isActive ? "var(--text-inverse)" : "var(--text-heading)",
                        cursor: "pointer",
                        transition: "var(--transition-control)",
                      }}
                    >
                      <span className="jp" style={{ fontSize: 26, lineHeight: 1 }}>
                        {entry.char}
                      </span>
                      {entry.canWrite && (
                        <span
                          aria-label={x.canWriteDot}
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "var(--radius-full)",
                            background: "var(--accent)",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      {active && (
        <div ref={detailRef} className="kanji-detail" style={{ alignSelf: "start", scrollMarginTop: 16 }}>
          <Card tone="cream" pad="lg" radius="lg">
            <div className="stack" style={{ gap: 22 }}>
              <div className="row" style={{ gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                <StrokeDiagram
                  char={active.char}
                  paths={active.strokePaths}
                  viewBox={viewBox}
                  size={160}
                  mode="animate"
                />
                <div className="stack" style={{ gap: 10, flex: 1, minWidth: 150 }}>
                  <div
                    style={{
                      fontSize: "var(--text-heading-3)",
                      color: "var(--on-tint-heading)",
                      lineHeight: 1.2,
                    }}
                  >
                    {active.meanings.join(", ")}
                  </div>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    <Badge tone="sage">{t.kanji.strokes(active.strokes)}</Badge>
                    <Badge tone="soft">{t.common.band[active.reading.band]}</Badge>
                    {active.canWrite && <Badge tone="accent">{x.canWrite}</Badge>}
                  </div>
                  <div className="body-sm" style={{ color: "var(--on-tint-body)" }}>
                    {x.wordsKnown(active.reading.known, active.reading.total)}
                  </div>
                </div>
              </div>

              {/* Keyed by character so a pending mark on one cannot show on the next. */}
              <div key={active.char} className="stack" style={{ gap: 8 }}>
                <MarkControl
                  scope="kanji"
                  id={active.char}
                  skill="reading"
                  state={active.readingMarks}
                  markLabel={x.markReading(active.char)}
                  markedLabel={x.markedReading}
                  title={x.markReadingTitle(active.char)}
                  onTint
                />
                {active.writingMarks && (
                  <MarkControl
                    scope="kanji"
                    id={active.char}
                    skill="writing"
                    state={active.writingMarks}
                    markLabel={x.markWriting(active.char)}
                    markedLabel={x.markedWriting}
                    onTint
                  />
                )}
              </div>

              <div className="stack" style={{ gap: 10 }}>
                {[
                  [t.kanji.on, active.onyomi],
                  [t.kanji.kun, active.kunyomi],
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

              <KanjiAnatomy kanji={active} variant="reference" onTint />

              <div style={{ height: 1, background: "var(--border-default)" }} />

              <div className="stack" style={{ gap: 12 }}>
                <p className="eyebrow" style={{ color: "var(--on-tint-body)" }}>
                  {x.taughtIn(active.level, String(active.lessonOrder).padStart(2, "0"))}
                </p>
                <Link href={`/lessons/${active.lessonSlug}`} className="reset-link">
                  <span style={{ color: "var(--on-tint-heading)", fontWeight: "var(--weight-semibold)" }}>
                    {active.lessonTitle} →
                  </span>
                </Link>
              </div>

              <div className="stack" style={{ gap: 12 }}>
                <p className="eyebrow" style={{ color: "var(--on-tint-body)" }}>
                  {x.wordsUseIt(active.words.length)}
                </p>
                <div className="stack" style={{ gap: 10, maxHeight: 280, overflowY: "auto" }}>
                  {active.words.map((w) => (
                    <div key={w.id} className="row" style={{ gap: 14, justifyContent: "space-between" }}>
                      <span className="jp" style={{ fontSize: 18, color: "var(--on-tint-heading)" }}>
                        {w.word}
                        <span style={{ color: "var(--on-tint-body)", fontSize: 14, marginLeft: 8 }}>
                          {w.reading}
                        </span>
                      </span>
                      <span className="body-sm" style={{ color: "var(--on-tint-body)", textAlign: "right" }}>
                        {w.meanings[0]}
                      </span>
                    </div>
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
