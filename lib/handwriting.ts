/**
 * Checks a handwritten kanji against its KanjiVG model.
 *
 * Nothing here looks at pixels. The pad records each stroke as the points the
 * pointer passed through, and KanjiVG stores each model stroke as a path drawn
 * from its start to its end, in writing order — so both sides are lists of
 * strokes with a direction, a length and a shape. Comparing those directly
 * answers what a picture cannot, which way a stroke went and in what order,
 * and is far kinder to honest writing than comparing images, which punishes a
 * character for being a little small or off-centre.
 *
 * How a drawing is judged:
 *
 * 1. Every stroke, drawn or model, is resampled to the same number of evenly
 *    spaced points, so a stroke drawn slowly (many points) and one drawn fast
 *    (few) compare alike.
 * 2. The drawing is scaled and moved onto the model. Writing small, large or
 *    off-centre does not make a kanji harder to read, so it costs nothing.
 *    Only uniform scale and position are taken out, never rotation or stretch,
 *    which are real faults.
 * 3. Each drawn stroke is paired with the model stroke it most resembles,
 *    whatever the order or direction, by optimal assignment. Pairing by
 *    resemblance rather than by position in the sequence is what lets a stroke
 *    written out of order be recognised as that, instead of as one wrong
 *    stroke followed by several more.
 * 4. Each pair is scored on position, length and shape, and the mean is how
 *    readable the character is. Order and direction are reported and cost a
 *    little, but they do not change what the finished character looks like.
 * 5. The drawing is scored the same way against every other kanji of the
 *    level. A drawing nearer to another character than to its own is not
 *    readable as its own, however tidy it is.
 *
 * The thresholds were tuned on synthetic writing — the model strokes jittered,
 * shifted, resized and deliberately broken — and should be revisited against
 * real handwriting. The result is advice to the learner, never a grade.
 */

export type Point = { x: number; y: number };

/** Strokes in writing order, each the points the pointer passed through, in {@link BOX} units. */
export type Ink = Point[][];

/** KanjiVG's viewBox is 0 0 109 109. The pad records in the same units, so the two line up as they are. */
export const BOX = 109;

/** At or above this score the check suggests the learner got it. */
export const PASS_SCORE = 70;

/** Points per stroke after resampling. Enough to keep the turn of a hook. */
const N = 32;

/** Steps per Bézier segment when flattening a KanjiVG path. */
const CURVE_STEPS = 12;

/**
 * Model strokes shorter than this, in box units, are dots and ticks. A dot has
 * no shape worth judging, and a learner taps it rather than draws it, so its
 * shape and length are held to a much looser standard.
 */
const SHORT = 12;

/**
 * The cost, as a mean distance in box units, of leaving a drawn or a model
 * stroke unpaired. A pair is only formed when it costs less than leaving both
 * out, 2 × this: past that, a line on the wrong side of the character is
 * reported as an extra stroke and the one it replaced as missing, which is
 * both kinder and more accurate than calling it "stroke 3, badly".
 */
const UNPAIRED = 14;

/** Taken off the score per stroke written backwards or out of order, up to the cap. */
const HABIT_COST = 5;
const HABIT_CAP = 25;

/**
 * A stroke missing or added makes a different character, however neat the
 * rest is — the rule the stroke counter under the pad has always applied.
 */
const COUNT_CAP = 60;

/**
 * Taken off per pair of strokes whose lengths are the wrong way round. That
 * is the whole difference between 土 and 士, or 末 and 未, and with 士 not in
 * the level there is no lookalike to catch it instead.
 */
const PROPORTION_COST = 12;

/** How much better another kanji has to fit before the drawing is said to read as that one. */
const LOOKALIKE_MARGIN = 0.04;
/** ...and how well it has to fit at all, so a scrawl is not said to resemble anything. */
const LOOKALIKE_FLOOR = 0.55;
const LOOKALIKE_CAP = 40;

/* -------------------------------------------------------------------------- */
/* Geometry                                                                   */

type Stroke = {
  /** {@link N} evenly spaced points, in the direction the stroke was written. */
  pts: Point[];
  len: number;
  /** Centroid of {@link pts}. */
  c: Point;
};

/** A uniform scale and a shift: drawn point p lands on the model at s·p + t. */
type Frame = { s: number; tx: number; ty: number };

const IDENTITY: Frame = { s: 1, tx: 0, ty: 0 };

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** 0 at or below a, 1 at or above b, linear between. */
const ramp = (v: number, a: number, b: number) => clamp((v - a) / (b - a), 0, 1);

const place = (f: Frame, p: Point): Point => ({ x: f.s * p.x + f.tx, y: f.s * p.y + f.ty });
const unplace = (f: Frame, p: Point): Point => ({ x: (p.x - f.tx) / f.s, y: (p.y - f.ty) / f.s });

function centroid(pts: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

function polyLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
  return len;
}

function resample(pts: Point[]): Point[] {
  const along = [0];
  for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + dist(pts[i - 1], pts[i]));
  const total = along[along.length - 1];
  // A tap: one point, or several on top of each other.
  if (!(total > 0)) return Array.from({ length: N }, () => ({ ...pts[0] }));

  const out: Point[] = [];
  let j = 1;
  for (let k = 0; k < N; k++) {
    const target = (total * k) / (N - 1);
    while (j < pts.length - 1 && along[j] < target) j++;
    const span = along[j] - along[j - 1] || 1;
    const t = clamp((target - along[j - 1]) / span, 0, 1);
    const a = pts[j - 1];
    const b = pts[j];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/**
 * Two light passes of a moving average, ends pinned.
 *
 * A finger or a mouse wobbles, and a wobble adds length and bend that the
 * stroke was never meant to have — enough, unsmoothed, to call a fair
 * horizontal "not straight". Applied to the model as well, so a hook is
 * rounded off equally on both sides and still compares alike.
 */
function smooth(pts: Point[]): Point[] {
  let cur = pts;
  for (let pass = 0; pass < 2; pass++) {
    cur = cur.map((p, i) =>
      i === 0 || i === cur.length - 1
        ? p
        : {
            x: 0.25 * cur[i - 1].x + 0.5 * p.x + 0.25 * cur[i + 1].x,
            y: 0.25 * cur[i - 1].y + 0.5 * p.y + 0.25 * cur[i + 1].y,
          },
    );
  }
  return cur;
}

function toStroke(raw: Point[]): Stroke {
  const pts = smooth(resample(raw));
  return { pts, len: polyLength(pts), c: centroid(pts) };
}

/** The same points, walked the other way when the stroke was written backwards. */
const orient = (pts: Point[], reversed: boolean) => (reversed ? [...pts].reverse() : pts);

/** Straight-line distance from start to end over the length travelled: 1 for a line, less for a bend. */
function straightness(pts: Point[], len: number): number {
  return len < 1 ? 1 : dist(pts[0], pts[pts.length - 1]) / len;
}

/* -------------------------------------------------------------------------- */
/* KanjiVG paths                                                              */

const TOKEN = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

/**
 * Flattens a KanjiVG stroke into points.
 *
 * KanjiVG uses only moveto and cubic Béziers (M, C, c, S, s); lines are
 * handled as well so a hand-edited path does not break the check.
 */
export function pathPoints(d: string): Point[] {
  const tokens = d.match(TOKEN) ?? [];
  const out: Point[] = [];
  let i = 0;
  let cmd = "M";
  let x = 0;
  let y = 0;
  // Second control point of the previous curve, reflected by S.
  let cx = 0;
  let cy = 0;
  let prevCubic = false;

  const num = () => Number(tokens[i++]);

  function cubic(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    const x0 = x;
    const y0 = y;
    for (let s = 1; s <= CURVE_STEPS; s++) {
      const t = s / CURVE_STEPS;
      const mt = 1 - t;
      out.push({
        x: mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3,
        y: mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3,
      });
    }
    cx = x2;
    cy = y2;
    x = x3;
    y = y3;
    prevCubic = true;
  }

  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    const before = i;

    switch (cmd.toUpperCase()) {
      case "M": {
        x = ox + num();
        y = oy + num();
        out.push({ x, y });
        prevCubic = false;
        // Further pairs after a moveto are linetos.
        cmd = rel ? "l" : "L";
        break;
      }
      case "L": {
        x = ox + num();
        y = oy + num();
        out.push({ x, y });
        prevCubic = false;
        break;
      }
      case "C": {
        const x1 = ox + num();
        const y1 = oy + num();
        const x2 = ox + num();
        const y2 = oy + num();
        cubic(x1, y1, x2, y2, ox + num(), oy + num());
        break;
      }
      case "S": {
        const x1 = prevCubic ? 2 * x - cx : x;
        const y1 = prevCubic ? 2 * y - cy : y;
        const x2 = ox + num();
        const y2 = oy + num();
        cubic(x1, y1, x2, y2, ox + num(), oy + num());
        break;
      }
      default:
        // Anything else (Z, arcs) never appears in KanjiVG; skip its numbers.
        while (i < tokens.length && !/[A-Za-z]/.test(tokens[i])) i++;
    }

    // A truncated path runs out of numbers mid-command.
    if (i === before || Number.isNaN(x) || Number.isNaN(y)) break;
  }

  return out.filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y));
}

const models = new Map<string, Stroke[]>();

function modelOf(paths: readonly string[]): Stroke[] {
  const key = paths.join("|");
  let strokes = models.get(key);
  if (!strokes) {
    strokes = paths.map(pathPoints).filter((p) => p.length > 0).map(toStroke);
    models.set(key, strokes);
  }
  return strokes;
}

/* -------------------------------------------------------------------------- */
/* Fitting and pairing                                                        */

/**
 * The frame that puts the drawing's centre and spread onto the model's.
 *
 * Used before anything is paired. Points are weighted by the length of their
 * stroke, so a long stroke counts for more than a dot when finding the middle.
 */
function spreadFrame(ink: Stroke[], model: Stroke[]): Frame {
  function spread(strokes: Stroke[]) {
    let w = 0;
    let x = 0;
    let y = 0;
    for (const s of strokes) {
      const wt = Math.max(s.len, 1);
      for (const p of s.pts) {
        w += wt;
        x += wt * p.x;
        y += wt * p.y;
      }
    }
    const c = { x: x / w, y: y / w };
    let r = 0;
    for (const s of strokes) {
      const wt = Math.max(s.len, 1);
      for (const p of s.pts) r += wt * ((p.x - c.x) ** 2 + (p.y - c.y) ** 2);
    }
    return { c, r: Math.sqrt(r / w) };
  }

  const a = spread(ink);
  const b = spread(model);
  const s = a.r > 0.5 ? clamp(b.r / a.r, 0.25, 4) : 1;
  return { s, tx: b.c.x - s * a.c.x, ty: b.c.y - s * a.c.y };
}

/** Least-squares scale and shift taking each drawn point onto its model point. */
function fitFrame(pairs: [Point[], Point[]][], fallback: Frame): Frame {
  const us = pairs.flatMap(([u]) => u);
  const ms = pairs.flatMap(([, m]) => m);
  if (us.length === 0) return fallback;
  const cu = centroid(us);
  const cm = centroid(ms);
  let num = 0;
  let den = 0;
  for (let i = 0; i < us.length; i++) {
    const ux = us[i].x - cu.x;
    const uy = us[i].y - cu.y;
    num += ux * (ms[i].x - cm.x) + uy * (ms[i].y - cm.y);
    den += ux * ux + uy * uy;
  }
  // A single dot has no extent to fit a scale to.
  if (den < 1 || num <= 0) return fallback;
  const s = clamp(num / den, 0.25, 4);
  return { s, tx: cm.x - s * cu.x, ty: cm.y - s * cu.y };
}

type Pair = {
  ink: number;
  model: number;
  /** Mean point distance with the drawn stroke taken as written, and taken backwards. */
  fwd: number;
  rev: number;
};

function pairCost(u: Point[], m: Point[]) {
  let fwd = 0;
  let rev = 0;
  for (let i = 0; i < N; i++) {
    fwd += dist(u[i], m[i]);
    rev += dist(u[N - 1 - i], m[i]);
  }
  return { fwd: fwd / N, rev: rev / N };
}

/**
 * Minimum-cost assignment on a square matrix (the Hungarian method).
 * Returns the column given to each row.
 */
function assign(cost: number[][]): number[] {
  const n = cost.length;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const col = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j]) col[p[j] - 1] = j - 1;
  return col;
}

/**
 * Pairs drawn strokes with model strokes by resemblance.
 *
 * Every stroke on either side may instead go unpaired at a fixed cost, which
 * is how a stroke count that differs from the model's is absorbed: the matrix
 * gets a dummy row per model stroke and a dummy column per drawn one.
 */
function pairUp(ink: Stroke[], model: Stroke[], frame: Frame): Pair[] {
  const a = ink.length;
  const b = model.length;
  const k = a + b;
  const placed = ink.map((s) => s.pts.map((p) => place(frame, p)));
  const costs: { fwd: number; rev: number }[][] = placed.map((u) => model.map((m) => pairCost(u, m.pts)));

  const matrix: number[][] = [];
  for (let i = 0; i < k; i++) {
    const row: number[] = [];
    for (let j = 0; j < k; j++) {
      if (i < a && j < b) row.push(Math.min(costs[i][j].fwd, costs[i][j].rev));
      else if (i < a || j < b) row.push(UNPAIRED);
      else row.push(0);
    }
    matrix.push(row);
  }

  const pairs: Pair[] = [];
  assign(matrix).forEach((j, i) => {
    if (i < a && j >= 0 && j < b) pairs.push({ ink: i, model: j, ...costs[i][j] });
  });
  return pairs;
}

/* -------------------------------------------------------------------------- */
/* Judging one stroke                                                         */

type Measure = {
  pair: Pair;
  /** Length once placed on the model. */
  len: number;
  /** Drawn centroid minus model centroid, in box units. Positive is right and down. */
  offset: Point;
  /** Mean distance between the two strokes once each is centred and scaled to unit length. */
  shape: number;
  /** Degrees between the start-to-end lines of the two strokes. */
  angle: number;
  straight: number;
  /** 0–1: how well the stroke stands in for the model's, for readability. */
  score: number;
};

/** Degrees between the start-to-end lines of two strokes; 0 when either is too short to have one. */
function chordAngle(a: Point[], b: Point[]): number {
  const ax = a[a.length - 1].x - a[0].x;
  const ay = a[a.length - 1].y - a[0].y;
  const bx = b[b.length - 1].x - b[0].x;
  const by = b[b.length - 1].y - b[0].y;
  const chords = Math.hypot(ax, ay) * Math.hypot(bx, by);
  return chords < 4 ? 0 : (Math.acos(clamp((ax * bx + ay * by) / chords, -1, 1)) * 180) / Math.PI;
}

/**
 * The stroke whose length a stroke is judged against: the latest earlier one
 * running the same way, or failing that the one just before.
 *
 * Proportions that make a kanji readable are between parallel strokes — the
 * two bars of 土, the top and bottom of 末 — and the stroke just before is
 * often a vertical that says nothing about a horizontal's length.
 */
function partnerOf(j: number, model: Stroke[]): number {
  for (let i = j - 1; i >= 0; i--) {
    if (model[i].len >= SHORT && chordAngle(model[i].pts, model[j].pts) < 30) return i;
  }
  return j - 1;
}

/** Written backwards, as opposed to being a short or symmetrical stroke that fits either way round. */
const isReversed = (me: Measure, m: Stroke) => m.len >= 8 && me.len >= 4 && me.pair.rev < me.pair.fwd * 0.75;

function measure(stroke: Stroke, m: Stroke, frame: Frame, pair: Pair): Measure {
  const pts = orient(stroke.pts, pair.rev < pair.fwd).map((p) => place(frame, p));
  const len = stroke.len * frame.s;
  const c = centroid(pts);
  const offset = { x: c.x - m.c.x, y: c.y - m.c.y };

  const su = Math.max(len, 4);
  const sm = Math.max(m.len, 4);
  let shape = 0;
  for (let i = 0; i < N; i++) {
    shape += Math.hypot((pts[i].x - c.x) / su - (m.pts[i].x - m.c.x) / sm, (pts[i].y - c.y) / su - (m.pts[i].y - m.c.y) / sm);
  }
  shape /= N;

  const angle = chordAngle(pts, m.pts);

  const short = m.len < SHORT;
  const posS = 1 - ramp(Math.hypot(offset.x, offset.y), 4, 16);
  const lenErr = Math.abs(Math.log(Math.max(len, 3) / Math.max(m.len, 3)));
  const lenS = 1 - (short ? ramp(lenErr, 0.6, 1.6) : ramp(lenErr, 0.2, 0.8));
  const shapeS = 1 - ramp(shape, 0.06, 0.26);
  // Shape multiplies rather than adds: a diagonal in the right place and at
  // the right length is still not a horizontal, and must not score most of
  // one. A dot's shape barely counts.
  const score = (0.55 * posS + 0.45 * lenS) * (short ? 0.8 + 0.2 * shapeS : 0.25 + 0.75 * shapeS);

  return { pair, len, offset, shape, angle, straight: straightness(pts, len), score };
}

/** The way a model stroke runs, in words. */
function describe(m: Stroke): string {
  const dx = m.pts[N - 1].x - m.pts[0].x;
  const dy = m.pts[N - 1].y - m.pts[0].y;
  if (Math.abs(dx) > 2.5 * Math.abs(dy)) return dx > 0 ? "from left to right" : "from right to left";
  if (Math.abs(dy) > 2.5 * Math.abs(dx)) return dy > 0 ? "from top to bottom" : "from bottom to top";
  return `${dy > 0 ? "down" : "up"} and to the ${dx > 0 ? "right" : "left"}`;
}

function where(o: Point): string {
  const h = Math.abs(o.x) >= 7 ? (o.x > 0 ? "far right" : "far left") : null;
  const v = Math.abs(o.y) >= 7 ? (o.y > 0 ? "low" : "high") : null;
  if (h && v) return `${v} and too ${h}`;
  return h ?? v ?? "far from its place";
}

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

type Partner = { n: number; me: Measure; m: Stroke };

/**
 * The single most useful thing to say about how a stroke looks, if anything.
 *
 * Shape comes first because it is what makes a stroke a different stroke;
 * then length against its partner stroke (see {@link partnerOf}); then where
 * it sits and how long it is overall. Those last two need a settled frame,
 * which the hint for an early stroke lacks.
 *
 * `flip` marks lengths the wrong way round, which the score charges for.
 */
function lookIssue(
  n: number,
  me: Measure,
  m: Stroke,
  partner: Partner | null,
  framed: boolean,
): { text: string; flip: boolean } | null {
  const long = m.len >= SHORT;
  const modelStraight = straightness(m.pts, m.len);
  const say = (text: string, flip = false) => ({ text, flip });

  if (long && modelStraight < 0.8 && me.straight > modelStraight + 0.12) {
    return say(`Stroke ${n} should bend or hook, not run straight.`);
  }
  if (long && modelStraight > 0.95 && me.straight < 0.87) return say(`Stroke ${n} should be a straight line.`);
  if (long && me.angle > 25) return say(`Stroke ${n} is at the wrong angle: it runs ${describe(m)}.`);
  if (long && me.shape > 0.22) return say(`Stroke ${n} is the wrong shape.`);

  if (partner && long && partner.m.len >= SHORT) {
    const drawn = Math.max(me.len, 1) / Math.max(partner.me.len, 1);
    const model = m.len / partner.m.len;
    const off = Math.abs(Math.log(drawn / model));
    const p = partner.n;
    // Getting the relation backwards is the mistake that turns one kanji
    // into another, so it is called out at a smaller error than a stroke
    // that is merely longer or shorter than it should be.
    if (off > 0.35 && model > 1.25 && drawn < 0.95) return say(`Stroke ${n} should be longer than stroke ${p}.`, true);
    if (off > 0.35 && model < 0.8 && drawn > 1.05) return say(`Stroke ${n} should be shorter than stroke ${p}.`, true);
    // When the partner is the stroke that is off, it gets its own message
    // below; blaming this one as well would send the learner to fix the
    // wrong stroke.
    const partnerWorse =
      framed && Math.abs(Math.log(partner.me.len / partner.m.len)) > Math.abs(Math.log(me.len / m.len));
    if (off > 0.6 && !partnerWorse) {
      return say(drawn > model ? `Stroke ${n} is too long next to stroke ${p}.` : `Stroke ${n} is too short next to stroke ${p}.`);
    }
  }

  if (framed && Math.hypot(me.offset.x, me.offset.y) > 13) return say(`Stroke ${n} sits too ${where(me.offset)}.`);
  if (framed && long) {
    const ratio = me.len / m.len;
    if (Math.abs(Math.log(ratio)) > 0.5) return say(`Stroke ${n} is too ${ratio > 1 ? "long" : "short"}.`);
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Judging a whole drawing                                                    */

type Evaluation = {
  frame: Frame;
  /** The pair for each model stroke, or undefined where it is missing. */
  byModel: (Measure | undefined)[];
  pairs: Measure[];
  extra: number[];
  missing: number[];
  /** 0–1: how well the drawing stands in for this model, ignoring order and direction. */
  readability: number;
};

function evaluate(ink: Stroke[], model: Stroke[]): Evaluation {
  let frame = spreadFrame(ink, model);
  let pairs = pairUp(ink, model, frame);
  // The first frame is thrown off by any stroke that is missing or extra, so
  // refit it on the strokes that did pair, and pair again.
  if (pairs.length > 0) {
    frame = fitFrame(
      pairs.map((p) => [orient(ink[p.ink].pts, p.rev < p.fwd), model[p.model].pts]),
      frame,
    );
    pairs = pairUp(ink, model, frame);
  }

  const byModel: (Measure | undefined)[] = new Array(model.length).fill(undefined);
  const measures = pairs.map((p) => {
    const me = measure(ink[p.ink], model[p.model], frame, p);
    byModel[p.model] = me;
    return me;
  });

  const paired = new Set(pairs.map((p) => p.ink));
  const extra = ink.map((_, i) => i).filter((i) => !paired.has(i));
  const missing = model.map((_, j) => j).filter((j) => !byModel[j]);
  const total = byModel.reduce((sum, me) => sum + (me ? me.score : 0), 0);

  return {
    frame,
    byModel,
    pairs: measures,
    extra,
    missing,
    // An extra stroke counts against the drawing exactly as a missing one
    // does, as a stroke scoring zero. Anything cheaper and a 日 missing a
    // stroke "reads more like" 二 plus a stray line, which it does not.
    readability: total / (model.length + extra.length),
  };
}

/**
 * Drawn strokes written at the wrong point in the order.
 *
 * The longest run of strokes whose model positions rise in the order they
 * were drawn is taken as the learner's intended order; whatever falls outside
 * it came too early or too late. Blaming the fewest strokes is what a teacher
 * would do too: one stroke written first by mistake is one mistake, not five.
 */
function outOfOrder(pairs: Pair[]): Set<number> {
  const seq = [...pairs].sort((a, b) => a.ink - b.ink);
  const best = seq.map(() => 1);
  const prev = seq.map(() => -1);
  for (let i = 0; i < seq.length; i++) {
    for (let j = 0; j < i; j++) {
      if (seq[j].model < seq[i].model && best[j] + 1 > best[i]) {
        best[i] = best[j] + 1;
        prev[i] = j;
      }
    }
  }
  const keep = new Set<number>();
  let end = best.indexOf(Math.max(...best, 0));
  while (end >= 0) {
    keep.add(seq[end].ink);
    end = prev[end];
  }
  return new Set(seq.filter((p) => !keep.has(p.ink)).map((p) => p.ink));
}

export type Issue = {
  /** The model stroke it concerns, 1-based, or null for the character as a whole. */
  stroke: number | null;
  text: string;
};

export type Assessment = {
  /** 0–100. */
  score: number;
  verdict: string;
  /** Whether the check would call it right. Advice only: the learner grades. */
  pass: boolean;
  issues: Issue[];
  /** Per drawn stroke: whether something is wrong with it, and which model stroke it was taken for (0-based). */
  strokes: { flagged: boolean; model: number | null }[];
  /** Model strokes the drawing lacks, placed where they belong on the pad. */
  missing: Point[][];
  /** Another kanji the drawing looks more like, if any. */
  lookalike: string | null;
};

function verdictFor(score: number): string {
  if (score >= 85) return "Clear";
  if (score >= PASS_SCORE) return "Readable";
  if (score >= 45) return "Hard to read";
  return "Not readable yet";
}

/**
 * Scores a finished drawing and says what is wrong with it.
 *
 * `bank` is every kanji of the level, by character, for the lookalike check.
 * Without it the drawing is only compared with its own model.
 */
export function assess(
  char: string,
  paths: readonly string[],
  ink: Ink,
  bank?: Readonly<Record<string, readonly string[]>> | null,
): Assessment | null {
  const target = modelOf(paths);
  const drawnInk = ink.filter((s) => s.length > 0);
  if (target.length === 0 || drawnInk.length === 0) return null;

  const drawn = drawnInk.map(toStroke);
  const ev = evaluate(drawn, target);

  let lookalike: string | null = null;
  if (bank) {
    let best = Math.max(ev.readability + LOOKALIKE_MARGIN, LOOKALIKE_FLOOR);
    for (const [other, otherPaths] of Object.entries(bank)) {
      // A kanji whose stroke count is far from what was drawn cannot fit
      // better than the target; skipping it keeps a big level cheap.
      if (other === char || Math.abs(otherPaths.length - drawn.length) > 2) continue;
      const otherModel = modelOf(otherPaths);
      if (otherModel.length === 0) continue;
      const r = evaluate(drawn, otherModel).readability;
      if (r > best) {
        best = r;
        lookalike = other;
      }
    }
  }

  const issues: Issue[] = [];
  const flagged = new Set<number>(ev.extra);

  if (lookalike) issues.push({ stroke: null, text: `This reads more like ${lookalike} than ${char}.` });
  if (ev.extra.length === 1) issues.push({ stroke: null, text: `One stroke does not match any stroke of ${char}.` });
  if (ev.extra.length > 1) issues.push({ stroke: null, text: `${ev.extra.length} strokes do not match any stroke of ${char}.` });

  const late = outOfOrder(ev.pairs.map((me) => me.pair));
  let habits = 0;
  let flips = 0;

  target.forEach((m, j) => {
    const n = j + 1;
    const me = ev.byModel[j];
    if (!me) {
      issues.push({ stroke: n, text: `Stroke ${n} is missing.` });
      return;
    }
    const said: string[] = [];
    if (isReversed(me, m)) said.push(`Stroke ${n} goes the wrong way: it runs ${describe(m)}.`);
    if (late.has(me.pair.ink)) said.push(`Stroke ${n} is out of order: you wrote it ${ordinal(me.pair.ink + 1)}.`);
    habits += said.length;
    const p = partnerOf(j, target);
    const partnerMe = ev.byModel[p];
    const look = lookIssue(n, me, m, partnerMe ? { n: p + 1, me: partnerMe, m: target[p] } : null, true);
    if (look) {
      said.push(look.text);
      if (look.flip) flips++;
    }
    if (said.length) flagged.add(me.pair.ink);
    for (const text of said) issues.push({ stroke: n, text });
  });

  let score = ev.readability * 100 - Math.min(HABIT_CAP, HABIT_COST * habits) - PROPORTION_COST * flips;
  if (ev.missing.length || ev.extra.length) score = Math.min(score, COUNT_CAP);
  if (lookalike) score = Math.min(score, LOOKALIKE_CAP);
  score = Math.round(clamp(score, 0, 100));

  const modelFor = new Map(ev.pairs.map((me) => [me.pair.ink, me.pair.model]));

  return {
    score,
    verdict: verdictFor(score),
    pass: score >= PASS_SCORE,
    issues,
    // Indexed like `ink`, so an empty stroke (never recorded by the pad) would shift nothing.
    strokes: ink.map((_, i) => {
      const at = drawnInk.indexOf(ink[i]);
      return { flagged: at >= 0 && flagged.has(at), model: at >= 0 ? (modelFor.get(at) ?? null) : null };
    }),
    missing: ev.missing.map((j) => target[j].pts.map((p) => unplace(ev.frame, p))),
    lookalike,
  };
}

/* -------------------------------------------------------------------------- */
/* Hints while writing                                                        */

export type Hint = {
  /** The drawn stroke this is about, 0-based. */
  stroke: number;
  ok: boolean;
  text: string;
  /** The model stroke to trace instead, placed on the pad. Only when something is wrong. */
  guide: Point[] | null;
};

/**
 * Feedback on the stroke just drawn, assuming the learner is following the
 * stroke order — the one thing a hint can take for granted that the final
 * check cannot.
 *
 * Where the character sits and how big it is are fixed by the strokes already
 * down. With fewer than two there is not enough to go on, so the pad itself is
 * the frame: it is the model's box, ruled the same way, and position and
 * overall length are not judged until the frame is settled.
 */
export function hint(paths: readonly string[], ink: Ink): Hint | null {
  const target = modelOf(paths);
  const k = ink.length - 1;
  if (k < 0 || target.length === 0 || ink[k].length === 0) return null;
  if (k >= target.length) {
    return { stroke: k, ok: false, text: `This kanji has only ${target.length} strokes.`, guide: null };
  }

  const drawn = ink.map((s) => (s.length ? toStroke(s) : toStroke([{ x: 0, y: 0 }])));
  const framed = k >= 2;
  const frame = framed
    ? fitFrame(
        drawn.slice(0, k).map((s, i) => {
          const c = pairCost(s.pts, target[i].pts);
          return [orient(s.pts, c.rev < c.fwd), target[i].pts];
        }),
        IDENTITY,
      )
    : IDENTITY;

  const placed = drawn[k].pts.map((p) => place(frame, p));
  const guide = target[k].pts.map((p) => unplace(frame, p));
  const own = pairCost(placed, target[k].pts);
  const ownCost = Math.min(own.fwd, own.rev);

  let later = -1;
  let laterCost = Infinity;
  for (let j = k + 1; j < target.length; j++) {
    const c = pairCost(placed, target[j].pts);
    const v = Math.min(c.fwd, c.rev);
    if (v < laterCost) {
      laterCost = v;
      later = j;
    }
  }
  if (later >= 0 && ownCost > 8 && laterCost < ownCost * 0.6) {
    return { stroke: k, ok: false, text: `That looks like stroke ${later + 1}. Stroke ${k + 1} comes first.`, guide };
  }

  const at = (i: number) => {
    const c = pairCost(drawn[i].pts.map((p) => place(frame, p)), target[i].pts);
    return measure(drawn[i], target[i], frame, { ink: i, model: i, ...c });
  };
  const me = at(k);
  if (isReversed(me, target[k])) {
    return { stroke: k, ok: false, text: `Stroke ${k + 1} goes the wrong way: it runs ${describe(target[k])}.`, guide };
  }

  const p = partnerOf(k, target);
  const partner = p >= 0 ? { n: p + 1, me: at(p), m: target[p] } : null;
  const look = lookIssue(k + 1, me, target[k], partner, framed);
  if (look) return { stroke: k, ok: false, text: look.text, guide };

  return { stroke: k, ok: true, text: `Stroke ${k + 1} looks right.`, guide: null };
}
