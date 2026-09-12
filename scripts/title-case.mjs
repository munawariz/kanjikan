/**
 * Title Case for meanings: "Fire", "Ten Thousand", "Coming to Japan".
 *
 * Every word is capitalised except short joining words in the middle of a
 * phrase. Qualifiers in parentheses stay as written ("Father (polite)"), and a
 * word that already has capitals past its first letter is left alone (OK, AM).
 *
 * The one definition the content is written to and checked against — see
 * validate-content.mjs.
 */
const MINOR = new Set([
  "a", "an", "the", "and", "or", "nor", "but",
  "of", "to", "in", "on", "at", "by", "for", "as", "from", "with", "per",
]);

function titleWords(text) {
  const words = text.split(" ");
  const last = words.length - 1;
  return words
    .map((word, i) => {
      if (!word) return word;
      if (/[A-Z]/.test(word.slice(1)) || word.includes(".")) return word;
      const bare = word.toLowerCase().replace(/[;,]$/, "");
      if (i > 0 && i < last && MINOR.has(bare)) return word.toLowerCase();
      return word
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("-");
    })
    .join(" ");
}

export function titleCase(text) {
  return text
    .split(/(\([^)]*\))/)
    .map((segment) => (segment.startsWith("(") ? segment : titleWords(segment)))
    .join("");
}
