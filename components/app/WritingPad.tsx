"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/atlas/core/Button.jsx";
import { StrokeDiagram } from "./StrokeDiagram";

/**
 * Writing practice.
 *
 * The learner writes the character from memory, then reveals the model and
 * grades themselves. Self-assessment rather than automatic scoring is a
 * deliberate limit: judging a handwritten kanji properly needs stroke-order and
 * shape matching against the input trace, and a naive pixel comparison would
 * fail correct writing constantly, which is worse than not grading at all.
 *
 * What is checked automatically is stroke count, which catches the most common
 * real mistake — dropping or inventing a stroke — and is unambiguous.
 */
export function WritingPad({
  char,
  paths,
  meaning,
  expectedStrokes,
  onGrade,
}: {
  char: string;
  paths: string[];
  meaning: string;
  expectedStrokes: number;
  onGrade: (correct: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const SIZE = 260;

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Back the canvas at device resolution, otherwise strokes look soft on any
    // high-DPI screen, which is most of them.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue("color") || "#111";
  }, []);

  useEffect(setup, [setup]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (revealed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
    setStrokeCount((n) => n + 1);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setStrokeCount(0);
  }

  const strokesMatch = strokeCount === expectedStrokes;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 6, textAlign: "center" }}>
        <span className="eyebrow">Write it from memory</span>
        <div style={{ fontSize: "var(--text-heading-2)", color: "var(--text-heading)" }}>
          {meaning}
        </div>
      </div>

      <div
        className="row"
        style={{ gap: 20, justifyContent: "center", flexWrap: "wrap", alignItems: "flex-start" }}
      >
        <div
          style={{
            position: "relative",
            width: SIZE,
            height: SIZE,
            borderRadius: "var(--radius-md)",
            background: "var(--surface-sunken)",
            border: "1px solid var(--border-default)",
            overflow: "hidden",
            color: "var(--text-heading)",
          }}
        >
          {/* Ruled guides matching the model diagram. */}
          <svg
            viewBox="0 0 109 109"
            width={SIZE}
            height={SIZE}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            aria-hidden
          >
            <g stroke="var(--border-default)" strokeWidth="0.5" strokeDasharray="4 4">
              <line x1="54.5" y1="0" x2="54.5" y2="109" />
              <line x1="0" y1="54.5" x2="109" y2="54.5" />
            </g>
          </svg>

          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            style={{
              width: SIZE,
              height: SIZE,
              display: "block",
              touchAction: "none",
              cursor: revealed ? "default" : "crosshair",
            }}
          />
        </div>

        {revealed && (
          <div className="stack" style={{ gap: 8, alignItems: "center" }}>
            <span className="eyebrow">Model</span>
            <StrokeDiagram char={char} paths={paths} size={SIZE} mode="animate" />
          </div>
        )}
      </div>

      <div
        className="row"
        style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
      >
        <span className="body-sm" style={{ color: strokeCount === 0 ? "var(--text-muted)" : strokesMatch ? "var(--positive-600)" : "var(--text-body)" }}>
          {strokeCount === 0
            ? `${expectedStrokes} strokes`
            : `${strokeCount} of ${expectedStrokes} strokes${strokesMatch ? " — count matches" : ""}`}
        </span>
        <Button variant="ghost" size="sm" onClick={clear} disabled={strokeCount === 0}>
          Clear
        </Button>
      </div>

      {!revealed ? (
        <Button variant="primary" size="lg" fullWidth onClick={() => setRevealed(true)}>
          Show the Answer
        </Button>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <p className="body-sm muted" style={{ margin: 0, textAlign: "center" }}>
            Compare the shape and the order. Did you get it right?
          </p>
          <div className="row" style={{ gap: 12 }}>
            <Button variant="outline" size="lg" fullWidth onClick={() => onGrade(false)}>
              Not Yet
            </Button>
            <Button variant="accent" size="lg" fullWidth onClick={() => onGrade(true)}>
              I Got It
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
