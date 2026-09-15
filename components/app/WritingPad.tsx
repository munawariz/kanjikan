"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Icon } from "@/components/atlas/core/Icon.jsx";
import type { Level } from "@/lib/content";
import { assess, BOX, hint as strokeHint, type Assessment, type Hint, type Ink, type Point } from "@/lib/handwriting";
import { loadStrokeBank } from "@/lib/strokeBank";
import { StrokeDiagram } from "./StrokeDiagram";

/** Issues listed before the rest fold away behind "Show all". */
const ISSUES_SHOWN = 5;

/**
 * Writing practice.
 *
 * The learner writes the character from memory, then reveals the model and
 * grades themselves. The pad records every stroke as the points it passed
 * through, so once the model is shown the drawing is checked stroke by stroke
 * against it — order, direction, length, shape, and whether the whole reads
 * as this kanji at all (see lib/handwriting.ts). The check scores and explains
 * but does not grade: it can be wrong, and failing a correctly written
 * character is worse than not grading at all. It highlights the grade it
 * would give, and the learner still chooses.
 *
 * With hints on, each stroke is also checked as soon as it is drawn, on the
 * assumption that the learner is following the stroke order, and a wrong one
 * shows the stroke that was due so it can be undone and traced again.
 */
export function WritingPad({
  char,
  paths,
  meaning,
  expectedStrokes,
  level,
  hints,
  onGrade,
  onKnown,
}: {
  char: string;
  paths: string[];
  meaning: string;
  expectedStrokes: number;
  level: Level;
  hints: boolean;
  onGrade: (correct: boolean) => void;
  /** Where offered: marks the writing known instead of grading an attempt. */
  onKnown?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  /**
   * The drawing, in KanjiVG's 109-unit box rather than in pixels, so it
   * survives the pad being resized and compares with the model as it is.
   */
  const ink = useRef<Ink>([]);
  /** The plain ink colour, for the segments drawn while the pointer moves. */
  const pen = useRef("#111");
  const [strokeCount, setStrokeCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [liveHint, setLiveHint] = useState<Hint | null>(null);
  /** Undefined until the check has run; null when there was nothing to check. */
  const [assessment, setAssessment] = useState<Assessment | null | undefined>(undefined);
  const [allIssues, setAllIssues] = useState(false);

  /**
   * The pad is square and as large as the column allows, up to 260.
   *
   * A canvas needs real pixel dimensions, so this cannot be done in CSS: the
   * width is measured and fed back as state. 260 was previously hard-coded,
   * which overflowed the page on any phone narrower than about 340px.
   */
  const [SIZE, setSize] = useState(260);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    // The row, not the pad's own column: the column is only as wide as the
    // pad, so measuring it would let the pad shrink but never grow back.
    const measure = () => {
      const available = Math.floor(row.clientWidth);
      // No lower bound: a floor larger than the space available is exactly the
      // overflow this measurement exists to prevent. 260 is only the cap.
      setSize(available > 0 ? Math.min(260, available) : 260);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, []);

  // Fetched now, while the learner writes, so the check has every kanji up to
  // this level to compare against by the time the answer is shown.
  useEffect(() => {
    void loadStrokeBank(level);
  }, [level]);

  const lineWidth = Math.max(6, Math.round(SIZE / 32));

  /**
   * Redraws the whole drawing from the recorded strokes.
   *
   * Strokes the check found fault with are drawn in red once the answer is
   * shown, and the stroke a hint is about in amber before then. strokeCount
   * is a dependency only so that undo and clear repaint.
   */
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Backed at device resolution, otherwise strokes look soft on any high-DPI
    // screen, which is most of them.
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(SIZE * dpr);
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const css = getComputedStyle(canvas);
    pen.current = css.getPropertyValue("color") || "#111";
    const wrong = css.getPropertyValue("--negative-500").trim() || "#c8452f";
    const unsure = css.getPropertyValue("--warning-500").trim() || "#e8a33d";
    const k = SIZE / BOX;

    ink.current.forEach((stroke, i) => {
      const flagged = revealed
        ? Boolean(assessment?.strokes[i]?.flagged)
        : hints && liveHint !== null && !liveHint.ok && liveHint.stroke === i;
      ctx.strokeStyle = !flagged ? pen.current : revealed ? wrong : unsure;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * k, stroke[0].y * k);
      // A tap is a stroke too, and a zero-length line draws nothing.
      if (stroke.length === 1) ctx.lineTo(stroke[0].x * k + 0.01, stroke[0].y * k);
      for (let j = 1; j < stroke.length; j++) ctx.lineTo(stroke[j].x * k, stroke[j].y * k);
      ctx.stroke();
    });
  }, [SIZE, lineWidth, revealed, assessment, hints, liveHint, strokeCount]);

  useEffect(() => {
    paint();
    // Ink colours are read from the theme when painting, so a theme switch
    // mid-card has to repaint, or dark ink is left on a dark pad.
    const theme = new MutationObserver(paint);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => theme.disconnect();
  }, [paint]);

  // Turning hints on checks the stroke already down; turning them off takes
  // the hint away rather than leaving a stale one to reappear later.
  useEffect(() => {
    if (!hints) setLiveHint(null);
    else if (!revealed && ink.current.length > 0) setLiveHint(strokeHint(paths, ink.current));
  }, [hints, revealed, paths]);

  useEffect(() => {
    if (!revealed) return;
    let live = true;
    const drawn = ink.current;
    void loadStrokeBank(level).then((bank) => {
      if (live) setAssessment(assess(char, paths, drawn, bank));
    });
    return () => {
      live = false;
    };
  }, [revealed, level, char, paths]);

  function pointAt(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * BOX) / SIZE, y: ((e.clientY - rect.top) * BOX) / SIZE };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (revealed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    ink.current = [...ink.current, [pointAt(e)]];
    drawing.current = true;
    setStrokeCount(ink.current.length);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const stroke = ink.current[ink.current.length - 1];
    const last = stroke[stroke.length - 1];
    const p = pointAt(e);
    // Pointer events arrive far faster than they carry meaning; a point this
    // close to the last adds only noise to the check.
    if (Math.hypot(p.x - last.x, p.y - last.y) < 0.5) return;
    stroke.push(p);

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const k = SIZE / BOX;
    ctx.strokeStyle = pen.current;
    ctx.beginPath();
    ctx.moveTo(last.x * k, last.y * k);
    ctx.lineTo(p.x * k, p.y * k);
    ctx.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (hints) setLiveHint(strokeHint(paths, ink.current));
  }

  function undo() {
    const removed = ink.current.length - 1;
    ink.current = ink.current.slice(0, -1);
    setStrokeCount(ink.current.length);
    // A hint about the stroke just taken back stays up, guide and all: that
    // is the stroke the learner is about to try again.
    setLiveHint((h) => (h && h.guide && h.stroke === removed ? h : null));
  }

  function clear() {
    ink.current = [];
    setStrokeCount(0);
    setLiveHint(null);
  }

  const strokesMatch = strokeCount === expectedStrokes;
  const unit = BOX / SIZE;
  const guides: Point[][] = revealed
    ? (assessment?.missing ?? [])
    : hints && liveHint?.guide
      ? [liveHint.guide]
      : [];
  const suggestion = assessment ? assessment.pass : null;
  const issues = assessment?.issues ?? [];
  const shownIssues = allIssues ? issues : issues.slice(0, ISSUES_SHOWN);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 6, textAlign: "center" }}>
        <span className="eyebrow">Write it from memory</span>
        <div style={{ fontSize: "var(--text-heading-2)", color: "var(--text-heading)" }}>
          {meaning}
        </div>
      </div>

      <div
        ref={rowRef}
        className="row"
        style={{ gap: 20, justifyContent: "center", flexWrap: "wrap", alignItems: "flex-start" }}
      >
        {/* Labelled like the model beside it. Both columns need the same
            label above the box, or the model sits a label's height lower
            than the pad once it is revealed. Always shown, so revealing the
            model does not push the pad down either. */}
        <div className="stack" style={{ gap: 8, alignItems: "center" }}>
          <span className="eyebrow">Your writing</span>
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
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onPointerLeave={end}
              style={{
                width: SIZE,
                height: SIZE,
                display: "block",
                touchAction: "none",
                cursor: revealed ? "default" : "crosshair",
              }}
            />

            {/* Ruled guides matching the model diagram, and over the ink the
                strokes to trace — the one a hint says was due, or after the
                answer the ones left out — and the number of each stroke the
                check found fault with, which is how the list below names it. */}
            <svg
              viewBox={`0 0 ${BOX} ${BOX}`}
              width={SIZE}
              height={SIZE}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
              aria-hidden
            >
              <g stroke="var(--border-default)" strokeWidth="0.5" strokeDasharray="4 4">
                <line x1="54.5" y1="0" x2="54.5" y2="109" />
                <line x1="0" y1="54.5" x2="109" y2="54.5" />
              </g>

              {guides.map((pts, i) => (
                <g key={i} opacity={0.75}>
                  <polyline
                    points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="var(--positive-500)"
                    strokeWidth={lineWidth * unit * 0.6}
                    strokeDasharray="3 2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Where it starts, since which end is which is half the point. */}
                  <circle cx={pts[0].x} cy={pts[0].y} r={2.4} fill="var(--positive-500)" />
                </g>
              ))}

              {revealed &&
                assessment?.strokes.map((s, i) => {
                  const first = ink.current[i]?.[0];
                  if (!s.flagged || s.model === null || !first) return null;
                  const x = Math.min(BOX - 5, Math.max(5, first.x - 4));
                  const y = Math.min(BOX - 5, Math.max(5, first.y - 4));
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r={4.6} fill="var(--negative-500)" />
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={6}
                        fontWeight={700}
                        fill="#fff"
                        style={{ fontFamily: "var(--font-text)" }}
                      >
                        {s.model + 1}
                      </text>
                    </g>
                  );
                })}
            </svg>
          </div>
        </div>

        {revealed && (
          <div className="stack" style={{ gap: 8, alignItems: "center" }}>
            <span className="eyebrow">Model</span>
            <StrokeDiagram char={char} paths={paths} size={SIZE} mode="animate" />
          </div>
        )}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div
          className="row"
          style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
        >
          <span className="body-sm" style={{ color: strokeCount === 0 ? "var(--text-muted)" : strokesMatch ? "var(--positive-600)" : "var(--text-body)" }}>
            {strokeCount === 0
              ? `${expectedStrokes} strokes`
              : `${strokeCount} of ${expectedStrokes} strokes${strokesMatch ? " — count matches" : ""}`}
          </span>
          {/* Both stop once the answer is shown: the check describes the
              drawing on the pad, and must not be left describing one that is
              no longer there. */}
          <div className="row" style={{ gap: 4 }}>
            <Button variant="ghost" size="sm" onClick={undo} disabled={strokeCount === 0 || revealed}>
              Undo
            </Button>
            <Button variant="ghost" size="sm" onClick={clear} disabled={strokeCount === 0 || revealed}>
              Clear
            </Button>
          </div>
        </div>

        {hints && !revealed && (
          <div
            role="status"
            aria-live="polite"
            className="row body-sm"
            style={{
              gap: 8,
              // Held open even when empty, so a hint appearing does not push
              // the button below out from under the learner's finger.
              minHeight: 22,
              alignItems: "flex-start",
              color: liveHint ? (liveHint.ok ? "var(--positive-600)" : "var(--text-heading)") : "var(--text-muted)",
            }}
          >
            {liveHint ? (
              <>
                <Icon
                  name={liveHint.ok ? "check" : "lightbulb"}
                  size={16}
                  color={liveHint.ok ? "var(--positive-600)" : "var(--warning-500)"}
                  style={{ marginTop: 2 }}
                />
                <span>
                  {liveHint.text}
                  {liveHint.guide &&
                    (liveHint.stroke < strokeCount
                      ? " Undo it and follow the green guide."
                      : " Follow the green guide.")}
                </span>
              </>
            ) : (
              <span>Hints are on: each stroke is checked as you draw it.</span>
            )}
          </div>
        )}
      </div>

      {!revealed ? (
        <div className="stack" style={{ gap: 8 }}>
          <Button variant="primary" size="lg" fullWidth onClick={() => setRevealed(true)}>
            Show the Answer
          </Button>
          {onKnown && (
            <Button
              variant="ghost"
              size="md"
              fullWidth
              onClick={onKnown}
              title={`Mark ${char} as one you can write, and skip it`}
            >
              I Can Already Write It
            </Button>
          )}
        </div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {assessment === undefined && strokeCount > 0 && paths.length > 0 && (
            <p className="body-sm muted" style={{ margin: 0, textAlign: "center" }}>
              Checking your writing…
            </p>
          )}

          {assessment && (
            <div
              className="stack"
              style={{
                gap: 12,
                padding: 16,
                borderRadius: "var(--radius-md)",
                background: "var(--surface-sunken)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <div className="row" style={{ alignItems: "baseline", gap: 6 }}>
                  <span
                    style={{
                      fontSize: "var(--text-stat-md)",
                      fontWeight: "var(--weight-extrabold)",
                      letterSpacing: "var(--tracking-stat)",
                      color: "var(--text-heading)",
                      lineHeight: 1,
                    }}
                  >
                    {assessment.score}
                  </span>
                  <span className="body-sm muted">/ 100</span>
                </div>
                <span
                  className="body-sm"
                  style={{
                    fontWeight: "var(--weight-semibold)",
                    color: assessment.pass ? "var(--text-brand)" : "var(--negative-500)",
                  }}
                >
                  {assessment.verdict}
                </span>
              </div>

              <div className="meter">
                <span style={{ width: `${assessment.score}%` }} />
              </div>

              {issues.length > 0 ? (
                <div className="stack" style={{ gap: 4, alignItems: "flex-start" }}>
                  <ul className="stack" style={{ gap: 6, margin: 0, paddingLeft: 18 }}>
                    {shownIssues.map((issue, i) => (
                      <li key={i} className="body-sm" style={{ color: "var(--text-body)" }}>
                        {issue.text}
                      </li>
                    ))}
                  </ul>
                  {issues.length > ISSUES_SHOWN && !allIssues && (
                    <Button variant="ghost" size="sm" onClick={() => setAllIssues(true)}>
                      Show All {issues.length}
                    </Button>
                  )}
                </div>
              ) : (
                <p className="body-sm" style={{ margin: 0, color: "var(--text-body)" }}>
                  Nothing to fix: the strokes, their order and their direction all match.
                </p>
              )}

              <p className="body-sm muted" style={{ margin: 0 }}>
                Suggested grade: {assessment.pass ? "I Got It" : "Not Yet"}. This is an automatic
                check and can be wrong, so the grade is yours.
              </p>
            </div>
          )}

          <p className="body-sm muted" style={{ margin: 0, textAlign: "center" }}>
            Compare the shape and the order. Did you get it right?
          </p>
          {/* The suggested grade is the filled button; with no check to go
              on, "I Got It" keeps the accent it always had. */}
          <div className="row" style={{ gap: 12 }}>
            <Button
              variant={suggestion === false ? "primary" : "outline"}
              size="lg"
              fullWidth
              onClick={() => onGrade(false)}
            >
              Not Yet
            </Button>
            <Button
              variant={suggestion === false ? "outline" : "accent"}
              size="lg"
              fullWidth
              onClick={() => onGrade(true)}
            >
              I Got It
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
