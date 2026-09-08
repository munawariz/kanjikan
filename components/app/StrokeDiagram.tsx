"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Stroke-order diagram, drawn from KanjiVG path data.
 *
 * Stroke data (c) Ulrich Apel, CC BY-SA 3.0 — https://kanjivg.tagaini.net
 *
 * Each stroke is drawn by animating stroke-dashoffset from its own length down
 * to zero, which traces the path in the direction it was authored. That is the
 * whole trick: the paths are already in writing order and already drawn in the
 * correct direction, so no interpolation is needed.
 */
export function StrokeDiagram({
  char,
  paths,
  viewBox = "0 0 109 109",
  size = 200,
  mode = "static",
  /** Milliseconds per stroke when animating. */
  strokeDuration = 550,
}: {
  char: string;
  paths: string[];
  viewBox?: string;
  size?: number;
  /** static shows the finished character; animate traces it stroke by stroke. */
  mode?: "static" | "animate";
  strokeDuration?: number;
}) {
  const [visible, setVisible] = useState(mode === "animate" ? 0 : paths.length);
  const [replayKey, setReplayKey] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];

    if (mode !== "animate") {
      setVisible(paths.length);
      return;
    }

    setVisible(0);
    for (let i = 0; i < paths.length; i++) {
      timers.current.push(setTimeout(() => setVisible(i + 1), i * strokeDuration));
    }
    return () => {
      for (const t of timers.current) clearTimeout(t);
    };
  }, [mode, paths, strokeDuration, replayKey]);

  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  if (paths.length === 0) {
    return (
      <div
        className="jp-display"
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.62,
          color: "var(--text-heading)",
        }}
        aria-label={char}
      >
        {char}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        viewBox={viewBox}
        width={size}
        height={size}
        role="img"
        aria-label={`Stroke order for ${char}`}
        style={{ display: "block" }}
      >
        {/* Writing guides, the way practice paper is ruled. */}
        <rect x="0" y="0" width="109" height="109" fill="var(--surface-sunken)" rx="6" />
        <g stroke="var(--border-default)" strokeWidth="0.5" strokeDasharray="4 4">
          <line x1="54.5" y1="0" x2="54.5" y2="109" />
          <line x1="0" y1="54.5" x2="109" y2="54.5" />
        </g>

        <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5">
          {paths.map((d, i) => {
            const done = i < visible;
            const current = i === visible - 1 && mode === "animate";
            return (
              <path
                key={`${replayKey}-${i}`}
                d={d}
                stroke={current ? "var(--accent)" : done ? "var(--text-heading)" : "transparent"}
                style={
                  current && !reduced
                    ? {
                        // 200 comfortably exceeds any single stroke's length on
                        // a 109-unit grid, so the dash fully hides the path.
                        strokeDasharray: 200,
                        animation: `kanji-draw ${strokeDuration}ms var(--ease-standard) forwards`,
                      }
                    : undefined
                }
              />
            );
          })}
        </g>
      </svg>

      {mode === "animate" && (
        <button
          type="button"
          onClick={() => setReplayKey((k) => k + 1)}
          aria-label="Replay stroke order"
          style={{
            position: "absolute",
            right: 6,
            bottom: 6,
            width: 30,
            height: 30,
            borderRadius: "var(--radius-full)",
            border: "1px solid var(--border-default)",
            background: "var(--surface-card)",
            color: "var(--text-heading)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      )}

      <style>{`
        @keyframes kanji-draw {
          from { stroke-dashoffset: 200; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
