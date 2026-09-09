#!/usr/bin/env node
/**
 * Renders the app icons from one HTML source using headless Edge.
 *
 *   npm run icons
 *
 * Why a browser rather than an SVG shipped as-is: an SVG favicon that sets its
 * glyph as <text> depends on the viewer having a CJK font, and PWA install
 * prompts want real PNGs at fixed sizes. Rasterising here bakes the glyph in,
 * so the icon looks identical everywhere and needs no font at display time.
 *
 * The face is Noto Sans JP, the project's --font-jp. It cannot be Figtree:
 * Atlas's brand face has no CJK coverage, so it has no 時 to draw.
 *
 * Set EDGE_PATH to override browser discovery.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const GLYPH = process.env.ICON_GLYPH ?? "時";
const OUT = path.join(process.cwd(), "public", "icons");

/* Atlas tokens, inlined because this runs outside the app. */
const FOREST = "#003511";
const LIME = "#d3fa53";
/* 14/64, the ratio used by app/icon.svg, itself derived from --radius-card. */
const RADIUS_RATIO = 14 / 64;

const CANDIDATES = [
  process.env.EDGE_PATH,
  "C:/Program Files (x86)/Microsoft/EdgeCore/152.0.4191.66/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].filter(Boolean);

function findBrowser() {
  for (const c of CANDIDATES) if (fs.existsSync(c)) return c;
  // Edge updates move its versioned directory, so fall back to a scan.
  const root = "C:/Program Files (x86)/Microsoft/EdgeCore";
  if (fs.existsSync(root)) {
    for (const dir of fs.readdirSync(root)) {
      const exe = path.join(root, dir, "msedge.exe");
      if (fs.existsSync(exe)) return exe;
    }
  }
  throw new Error("No Chromium browser found. Set EDGE_PATH to msedge.exe or chrome.exe.");
}

/**
 * @param size    output pixels
 * @param bleed   true for maskable icons: the OS crops to a circle or squircle,
 *                so the ground must fill the square and the glyph must stay
 *                inside the central 80% safe zone.
 */
function html(size, bleed) {
  const radius = bleed ? 0 : Math.round(size * RADIUS_RATIO);
  const glyphSize = Math.round(size * (bleed ? 0.46 : 0.62));
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&display=block" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;background:transparent}
  #icon{
    width:${size}px;height:${size}px;
    background:${FOREST};
    border-radius:${radius}px;
    display:flex;align-items:center;justify-content:center;
    font-family:"Noto Sans JP",sans-serif;
    font-weight:700;
    font-size:${glyphSize}px;
    line-height:1;
    color:${LIME};
    /* Kanji sit slightly high in their em box; nudge for true optical centre. */
    padding-bottom:${Math.round(size * 0.02)}px;
  }
</style></head><body><div id="icon">${GLYPH}</div></body></html>`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDGE = findBrowser();
const PORT = 9377;
const profile = path.join(os.tmpdir(), `edge-icons-${Date.now()}`);

const browser = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--force-color-profile=srgb", "about:blank",
]);

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const pages = (await res.json()).filter((t) => t.type === "page");
      if (pages[0]?.webSocketDebuggerUrl) return pages[0].webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("browser did not expose a debugging target");
}

const ws = new WebSocket(await target());
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) =>
  new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });

await send("Page.enable");
fs.mkdirSync(OUT, { recursive: true });

const TARGETS = [
  { file: "icon-192.png", size: 192, bleed: false },
  { file: "icon-512.png", size: 512, bleed: false },
  { file: "icon-maskable-512.png", size: 512, bleed: true },
  { file: "apple-touch-icon.png", size: 180, bleed: false },
];

for (const t of TARGETS) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: t.size, height: t.size, deviceScaleFactor: 1, mobile: false,
  });
  await send("Page.navigate", {
    url: "data:text/html;charset=utf-8," + encodeURIComponent(html(t.size, t.bleed)),
  });

  // display=block holds text invisible until the webfont arrives; capturing
  // early would bake in a blank square.
  await send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
  await sleep(400);

  const { result } = await send("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width: t.size, height: t.size, scale: 1 },
    captureBeyondViewport: true,
  });

  const file = path.join(OUT, t.file);
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
  console.log(`  ${t.file.padEnd(24)} ${t.size}x${t.size}  ${Math.round(fs.statSync(file).size / 1024)}KB`);
}

ws.close();
browser.kill();
console.log(`\nWrote ${TARGETS.length} icons to public/icons/ using glyph ${GLYPH}`);
process.exit(0);
