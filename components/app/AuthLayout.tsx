import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";

/**
 * Split auth screen: forest panel carrying the proposition, white panel
 * carrying the form. The forest half collapses away below 900px rather than
 * stacking, so the form stays the first thing on a phone.
 */
export function AuthLayout({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr", minHeight: "100vh" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          minHeight: "100vh",
        }}
        className="auth-split"
      >
        <section
          className="auth-aside"
          style={{
            background: "var(--forest-800)",
            padding: "56px 56px 64px",
            display: "none",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Link href="/" className="reset-link" style={{ position: "relative", zIndex: 1 }}>
            <Wordmark tone="inverse" />
          </Link>

          <div style={{ position: "relative", zIndex: 1, maxWidth: 420 }}>
            <Sparkle size={28} color="var(--lime-500)" />
            <h1
              style={{
                marginTop: 20,
                fontSize: "var(--text-display-3)",
                lineHeight: "var(--leading-display)",
                letterSpacing: "var(--tracking-display)",
                color: "var(--white)",
              }}
            >
              Learn the word, and the kanji comes with it.
            </h1>
            <p
              style={{
                marginTop: 20,
                fontSize: "var(--text-body-md)",
                lineHeight: "var(--leading-body)",
                color: "var(--forest-200)",
              }}
            >
              813 JLPT N5 words across 40 lessons. Your place is saved on every card, so you can
              stop after ninety seconds and pick the same queue up tomorrow.
            </p>
          </div>

          <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 40 }}>
            {[
              ["813", "Words"],
              ["80", "Kanji"],
              ["40", "Lessons"],
            ].map(([value, label]) => (
              <div key={label}>
                <div
                  style={{
                    fontSize: "var(--text-stat-sm)",
                    fontWeight: "var(--weight-extrabold)",
                    letterSpacing: "var(--tracking-stat)",
                    color: "var(--lime-500)",
                  }}
                >
                  {value}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-label-sm)",
                    letterSpacing: "var(--tracking-eyebrow)",
                    textTransform: "uppercase",
                    color: "var(--forest-200)",
                    marginTop: 4,
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Flat cropped circle — the one decorative shape Atlas allows. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: -120,
              top: 180,
              width: 380,
              height: 380,
              borderRadius: "var(--radius-full)",
              background: "var(--forest-700)",
            }}
          />
        </section>

        <section
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px var(--page-gutter)",
          }}
        >
          <div style={{ width: "100%", maxWidth: 400 }}>
            <div style={{ marginBottom: 32 }} className="auth-mobile-mark">
              <Link href="/" className="reset-link">
                <Wordmark />
              </Link>
            </div>

            <p className="eyebrow">{eyebrow}</p>
            <h2
              style={{
                margin: "10px 0 32px",
                fontSize: "var(--text-heading-1)",
                letterSpacing: "var(--tracking-heading)",
              }}
            >
              {title}
            </h2>

            {children}
          </div>
        </section>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .auth-split { grid-template-columns: 1fr 1fr; }
          .auth-aside { display: flex; }
          .auth-mobile-mark { display: none; }
        }
      `}</style>
    </main>
  );
}
