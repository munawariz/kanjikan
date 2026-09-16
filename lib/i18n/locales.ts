import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_LOCALE,
  isBuiltInLocale,
  isLocaleCode,
  type Locale,
  type LocaleInfo,
} from "./config";
import { messages, type Messages } from "./messages";
import { compileMessages, type InterfaceText } from "./template";

/*
 * The languages the app offers, read from data/jlpt/locales/.
 *
 * Every folder there named like a language code is a language, whether or not
 * it is finished: whatever it lacks is shown in English. A folder may hold
 *
 *   locale.json      { "name": "Français", "complete": false }
 *                    The name the pickers show (the code if there is none),
 *                    and whether validate-content holds it to 100%.
 *   interface.json   The interface text, for a language not written in
 *                    lib/i18n/messages. See lib/i18n/template.ts.
 *   levels.json, <level>/…   The content, as for English.
 *
 * Read once per server process in production. In development the list is
 * read on every request, so a new folder shows up without a restart.
 */

const LOCALE_ROOT = path.join(process.cwd(), "data", "jlpt", "locales");
const fresh = process.env.NODE_ENV !== "production";

type Manifest = { name?: unknown; complete?: unknown };

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

let listed: LocaleInfo[] | null = null;

/** English first, then the rest by code. */
export function listLocales(): LocaleInfo[] {
  if (listed && !fresh) return listed;
  const codes = fs.existsSync(LOCALE_ROOT)
    ? fs
        .readdirSync(LOCALE_ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory() && isLocaleCode(d.name))
        .map((d) => d.name)
    : [];
  if (!codes.includes(DEFAULT_LOCALE)) codes.push(DEFAULT_LOCALE);

  listed = codes
    .sort((a, b) => (a === DEFAULT_LOCALE ? -1 : b === DEFAULT_LOCALE ? 1 : a.localeCompare(b)))
    .map((code) => {
      const manifest = readJson<Manifest>(path.join(LOCALE_ROOT, code, "locale.json"));
      const name = typeof manifest?.name === "string" && manifest.name.trim() ? manifest.name.trim() : code;
      return { code, name };
    });
  return listed;
}

export function isAvailableLocale(value: unknown): value is Locale {
  return isLocaleCode(value) && listLocales().some((l) => l.code === value);
}

/**
 * A folder language's interface.json, or null for a language whose strings
 * are TypeScript, or that has not written any yet.
 */
export function readInterface(locale: Locale): InterfaceText | null {
  if (isBuiltInLocale(locale) || !isLocaleCode(locale)) return null;
  const text = readJson<unknown>(path.join(LOCALE_ROOT, locale, "interface.json"));
  if (text !== null && (typeof text !== "object" || Array.isArray(text))) {
    console.error(`[kanjikan] locales/${locale}/interface.json must be an object; showing English`);
    return null;
  }
  return text as InterfaceText | null;
}

const compiled = new Map<Locale, Messages>();

/** The strings for a language, with English for anything it has not translated. */
export function getMessages(locale: Locale): Messages {
  if (isBuiltInLocale(locale)) return messages[locale];
  let m = fresh ? undefined : compiled.get(locale);
  if (!m) {
    m = compileMessages(messages[DEFAULT_LOCALE], readInterface(locale), locale);
    compiled.set(locale, m);
  }
  return m;
}
