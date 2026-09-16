/**
 * Title Case for meanings: "Fire", "Ten Thousand", "Coming to Japan".
 *
 * Every word is capitalised except short joining words in the middle of a
 * phrase. Qualifiers in parentheses stay as written ("Father (polite)"), and a
 * word that already has capitals past its first letter is left alone (OK, AM).
 *
 * Indonesian follows the same rule with its own joining words: "Hari dan
 * Malam", "Orang yang Bekerja".
 *
 * A new language adds its joining words to MINOR. Until it does, every word
 * is capitalised.
 *
 * The one definition the content is written to and checked against — see
 * validate-content.mjs.
 */
const MINOR = {
  en: new Set([
    "a", "an", "the", "and", "or", "nor", "but",
    "of", "to", "in", "on", "at", "by", "for", "as", "from", "with", "per",
  ]),
  id: new Set([
    "dan", "atau", "tetapi", "serta",
    "di", "ke", "dari", "pada", "untuk", "dengan", "oleh", "per", "dalam", "yang", "sebagai", "tentang",
  ]),
};

function titleWords(text, minor) {
  const words = text.split(" ");
  const last = words.length - 1;
  return words
    .map((word, i) => {
      if (!word) return word;
      if (/[A-Z]/.test(word.slice(1)) || word.includes(".")) return word;
      const bare = word.toLowerCase().replace(/[;,]$/, "");
      if (i > 0 && i < last && minor.has(bare)) return word.toLowerCase();
      return word
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("-");
    })
    .join(" ");
}

export function titleCase(text, locale = "en") {
  const minor = MINOR[locale] ?? new Set();
  return text
    .split(/(\([^)]*\))/)
    .map((segment) => (segment.startsWith("(") ? segment : titleWords(segment, minor)))
    .join("");
}
