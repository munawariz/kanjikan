/**
 * Kanjikan wordmark.
 *
 * Atlas ships no logo file and sets its own name as type; this follows the same
 * rule at the same tracking so the two read as one system. The dot is the only
 * ornament, borrowed from the brand sparkle colour.
 */
export function Wordmark({ size = 22, tone = "light" }: { size?: number; tone?: "light" | "inverse" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 2,
        fontFamily: "var(--font-display)",
        fontSize: size,
        fontWeight: "var(--weight-extrabold)",
        letterSpacing: "-0.045em",
        lineHeight: 1,
        color: tone === "inverse" ? "var(--white)" : "var(--text-heading)",
      }}
    >
      kanjikan
      <span
        aria-hidden
        style={{
          width: size * 0.2,
          height: size * 0.2,
          borderRadius: "var(--radius-full)",
          background: "var(--lime-500)",
        }}
      />
    </span>
  );
}
