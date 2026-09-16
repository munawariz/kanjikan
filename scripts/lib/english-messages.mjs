/**
 * Loads the interface text written in lib/i18n/messages, for scripts.
 *
 * Those files are TypeScript (some with JSX), and scripts run on plain Node,
 * so each is transpiled in memory with the project's own TypeScript and run.
 * Their imports of other modules are types only, which transpiling removes;
 * what remains is each other and React's JSX runtime.
 *
 * describe() turns English into the list of keys a language's interface.json
 * can give, with what each one takes.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const MESSAGES = path.join(process.cwd(), "lib", "i18n", "messages");
const loaded = new Map();

function load(file) {
  if (loaded.has(file)) return loaded.get(file).exports;
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  loaded.set(file, module);
  const local = (spec) => {
    if (!spec.startsWith(".")) return require(spec);
    const base = path.resolve(path.dirname(file), spec);
    const found = [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find((f) => fs.existsSync(f));
    if (!found) throw new Error(`${path.relative(process.cwd(), file)}: cannot resolve ${spec}`);
    return load(found);
  };
  new Function("exports", "require", "module", outputText)(module.exports, local, module);
  return module.exports;
}

/** { en, excluded }: English's Messages, and the paths an interface.json may not replace. */
export function loadEnglish() {
  const index = load(path.join(MESSAGES, "index.ts"));
  return { en: index.messages.en, excluded: new Set(index.TEMPLATE_EXCLUDED) };
}

/**
 * Every key a language can translate, as a Map from dotted path to
 *   { kind: "string", english }
 *   { kind: "function", arity, tags, english: the function }
 * `tags` are the markup tags the function's first argument provides, such
 * as strong and jp, read from how English destructures it.
 */
export function describe(en, excluded) {
  const keys = new Map();
  const walk = (value, at) => {
    if (excluded.has(at)) return;
    if (typeof value === "string") keys.set(at, { kind: "string", english: value });
    else if (typeof value === "function") {
      const head = /^\s*(?:function\s*\w*)?\(\s*\{([^}]*)\}/.exec(value.toString());
      const tags = head ? head[1].split(",").map((s) => s.trim().split(/[:\s=]/)[0]).filter(Boolean) : [];
      keys.set(at, { kind: "function", arity: value.length, tags, english: value });
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${at}.${i}`));
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, at ? `${at}.${k}` : k);
    }
  };
  walk(en, "");
  return keys;
}

/**
 * English as a starting template: each string as it is, and each function
 * called with {0}, {1}… in place of its arguments. A function that decides
 * on a count or a flag shows one of its forms; the translator writes the
 * others. Returns null for a key whose English cannot be sampled this way.
 */
export function sample(entry) {
  if (entry.kind === "string") return entry.english;
  const args = Array.from({ length: entry.arity }, (_, i) => {
    const slot = Object.assign(new String(`{${i}}`), {
      join: () => `{${i}}`,
      map: () => [`{${i}}`],
    });
    for (const tag of entry.tags) slot[tag] = (text) => `<${tag}>${text}</${tag}>`;
    return slot;
  });
  // English destructures its markup from the first argument.
  try {
    return text(entry.english(...args));
  } catch {
    return null;
  }
}

/** A string, a String placeholder or a React tree, as the text it shows. */
function text(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number" || node instanceof String) return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (node.props) return text(node.props.children);
  throw new Error("not text");
}
