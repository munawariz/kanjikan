import { createElement, Fragment, isValidElement, type ReactNode } from "react";
import type { Locale } from "./config";
import { formatList, intlTag } from "./format";
import { TEMPLATE_EXCLUDED, type Messages } from "./messages";

/*
 * Interface text for a language that is only a folder.
 *
 * English's strings are TypeScript, and many are functions. A language added
 * as data/jlpt/locales/<locale>/ writes its strings in interface.json instead,
 * with the same keys, and this file turns that JSON back into Messages:
 *
 *   "save": "Save"                            a plain string
 *   "due": "{0} perlu diulas"                 {0}, {1}… are the arguments, in order
 *   "reviews": { "one": "{0} review",         a count: the forms Intl.PluralRules
 *                "other": "{0} reviews" }       names for the language, "=0" for an
 *                                               exact number, and "other" always
 *   "suggested": { "true": "Looks right",     a yes/no argument
 *                  "false": "Try again" }
 *   "help": "One part is the <strong>radical</strong>, like <jp>亻</jp>."
 *                                             markup, where English has it
 *
 * A list argument is joined the language's way ("N5 and N4"). "$arg": 2 picks
 * which argument a count or yes/no form follows; by default it is the first
 * number or the first true/false.
 *
 * Anything the file leaves out, or gets wrong, stays English. It is compiled
 * on the server for server components and in the browser for client ones,
 * from the same JSON, since functions cannot be sent between them.
 */

export type InterfaceText = { [key: string]: unknown };

type Forms = { [form: string]: unknown };

const FORM_KEYS = /^(zero|one|two|few|many|other|true|false|=\d+|\$arg)$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** An object of plural or yes/no forms, as opposed to a group of keys. */
export function isForms(value: unknown): value is Forms {
  return isPlainObject(value) && Object.keys(value).length > 0 && Object.keys(value).every((k) => FORM_KEYS.test(k));
}

/** Picks the form an argument list calls for. */
function choose(forms: Forms, args: unknown[], locale: Locale): string | undefined {
  const flag = "true" in forms || "false" in forms;
  const explicit = typeof forms.$arg === "number" ? forms.$arg : -1;
  const index =
    explicit >= 0 ? explicit : args.findIndex((a) => (flag ? typeof a === "boolean" : typeof a === "number"));
  const value = args[index];
  const pick = (key: string) => (typeof forms[key] === "string" ? (forms[key] as string) : undefined);

  if (flag) return pick(String(Boolean(value))) ?? pick("other");
  const n = Number(value);
  if (!Number.isFinite(n)) return pick("other");
  return pick(`=${n}`) ?? pick(new Intl.PluralRules(intlTag(locale)).select(n)) ?? pick("other");
}

/** One argument, as text or as a node. */
function argument(value: unknown, locale: Locale): ReactNode {
  if (typeof value === "string" || typeof value === "number") return value;
  if (Array.isArray(value)) {
    if (!value.every((v) => typeof v === "string" || typeof v === "number")) throw new Error("not a list of words");
    return formatList(locale, value.map(String));
  }
  if (isValidElement(value)) return value;
  throw new Error(`cannot place ${typeof value} in a template`);
}

const TOKEN = /\{(\d+)\}|<([a-z]+)>([\s\S]*?)<\/\2>/g;

/** Fills a template in. Plain text stays a string; anything with nodes becomes a fragment. */
function fill(template: string, args: unknown[], locale: Locale): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of template.matchAll(TOKEN)) {
    if (m.index > last) parts.push(template.slice(last, m.index));
    if (m[1] !== undefined) {
      const i = Number(m[1]);
      if (i >= args.length) throw new Error(`no argument {${i}}`);
      parts.push(argument(args[i], locale));
    } else {
      // Markup: English passes an object of wrappers, such as { strong, jp }.
      const inner = fill(m[3], args, locale);
      const wrap = args
        .map((a) => (isPlainObject(a) ? a[m[2]] : undefined))
        .find((w): w is (text: ReactNode) => ReactNode => typeof w === "function");
      parts.push(wrap ? wrap(inner) : inner);
    }
    last = m.index + m[0].length;
  }
  if (last < template.length) parts.push(template.slice(last));
  if (parts.every((p) => typeof p === "string" || typeof p === "number")) return parts.join("");
  return createElement(Fragment, null, ...parts);
}

/**
 * A translated function: the same arguments as English's, the template's
 * words. A template that cannot be filled for some call falls back to English
 * for that call, rather than showing a broken sentence.
 */
function translated(spec: string | Forms, english: (...args: unknown[]) => unknown, locale: Locale) {
  return (...args: unknown[]) => {
    try {
      const template = typeof spec === "string" ? spec : choose(spec, args, locale);
      if (template === undefined) return english(...args);
      return fill(template, args, locale);
    } catch {
      return english(...args);
    }
  };
}

function merge(english: unknown, over: unknown, locale: Locale, path: string): unknown {
  if (over === undefined || over === null || TEMPLATE_EXCLUDED.includes(path)) return english;
  if (typeof english === "function") {
    return typeof over === "string" || isForms(over)
      ? translated(over, english as (...args: unknown[]) => unknown, locale)
      : english;
  }
  if (typeof english === "string") return typeof over === "string" ? over : english;
  if (Array.isArray(english)) {
    // A list may be given as an array, or as an object of the items it changes: { "2": … }.
    if (!Array.isArray(over) && !isPlainObject(over)) return english;
    const items = over as Record<number, unknown>;
    return english.map((item, i) => merge(item, items[i], locale, `${path}.${i}`));
  }
  if (isPlainObject(english)) {
    if (!isPlainObject(over)) return english;
    return Object.fromEntries(
      Object.entries(english).map(([k, v]) => [k, merge(v, over[k], locale, path ? `${path}.${k}` : k)]),
    );
  }
  return english;
}

/** English, with every string the language has written put in its place. */
export function compileMessages(english: Messages, text: InterfaceText | null, locale: Locale): Messages {
  if (!text) return english;
  return merge(english, text, locale, "") as Messages;
}
