#!/usr/bin/env node
/**
 * Starts a new language.
 *
 *   npm run locale:new -- fr "Français"
 *
 * Creates data/jlpt/locales/<code>/ with
 *
 *   locale.json               { "name": …, "complete": false }
 *   interface.json            {} to fill in, if there is none yet
 *   interface.reference.json  every English interface string, as a template
 *
 * The language is in the app as soon as the folder exists, entirely in
 * English at first. Translate by copying entries from the reference into
 * interface.json, and by adding content files shaped like locales/en/.
 * The reference is regenerated on every run and is not committed.
 *
 * Run it again on an existing language to refresh the reference; nothing
 * else is overwritten.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, loadEnglish, sample } from "./lib/english-messages.mjs";

const [code, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim();

if (!code || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(code)) {
  console.error('Usage: npm run locale:new -- <code> "<name in that language>"   e.g. fr "Français"');
  process.exit(1);
}

const dir = path.join(process.cwd(), "data", "jlpt", "locales", code);
fs.mkdirSync(dir, { recursive: true });

const write = (file, value, { overwrite }) => {
  const at = path.join(dir, file);
  if (!overwrite && fs.existsSync(at)) return console.log(`kept     ${path.relative(process.cwd(), at)}`);
  fs.writeFileSync(at, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`wrote    ${path.relative(process.cwd(), at)}`);
};

write("locale.json", { name: name || code, complete: false }, { overwrite: false });
write("interface.json", {}, { overwrite: false });

// English, key for key, with {0}, {1}… where it takes values.
const { en, excluded } = loadEnglish();
const keys = describe(en, excluded);
const skipped = [];
const build = (value, at) => {
  if (excluded.has(at)) return undefined;
  if (typeof value === "string" || typeof value === "function") {
    const text = sample(keys.get(at));
    if (text === null) skipped.push(at);
    return text ?? undefined;
  }
  if (Array.isArray(value)) return value.map((v, i) => build(v, `${at}.${i}`));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const built = build(v, at ? `${at}.${k}` : k);
    if (built !== undefined) out[k] = built;
  }
  return out;
};
write("interface.reference.json", build(en, ""), { overwrite: true });

console.log(`
${code} is in the app now, shown in English until it is translated.

  Interface  copy entries from interface.reference.json into interface.json and
             translate them. A string with a count can become
             { "one": "{0} review", "other": "{0} reviews" }; see CONTRIBUTING.md.
  Content    add files shaped like data/jlpt/locales/en/.
  Progress   npm run validate:content -- --locale ${code}

Shown in English whatever interface.json says: ${[...excluded].join(", ")}${
  skipped.length ? `\nNot in the reference, because English could not be sampled: ${skipped.join(", ")}` : ""
}`);
