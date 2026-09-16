import { redirect } from "next/navigation";
import { isDatabaseConfigured } from "@/lib/db";
import { availableLevels, levelStats } from "@/lib/content";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Wordmark } from "@/components/app/Wordmark";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Shown by the middleware whenever the database URL is missing, which is the
 * state of a fresh clone. Content is bundled with the app, so the numbers
 * below are real even before a database exists.
 */
export default async function SetupPage() {
  if (isDatabaseConfigured) redirect("/");

  const stats = levelStats();
  const t = (await getT()).auth.setup;

  return (
    <main className="page" style={{ paddingTop: 64, paddingBottom: 96, maxWidth: 760 }}>
      <div className="stack" style={{ gap: 32 }}>
        <Wordmark size={24} />

        <div className="stack" style={{ gap: 16 }}>
          <Badge tone="warning">{t.badge}</Badge>
          <h1
            style={{
              margin: 0,
              fontSize: "var(--text-display-3)",
              letterSpacing: "var(--tracking-display)",
              lineHeight: "var(--leading-display)",
            }}
          >
            {t.title}
          </h1>
          <p style={{ margin: 0, maxWidth: 520 }}>
            {t.intro(stats.words, availableLevels(), stats.kanji)}
          </p>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          {t.steps.map((step, i) => (
            <Card key={step.title} tone={i % 2 === 0 ? "cream" : "sage"} pad="md" radius="lg">
              <div className="row" style={{ gap: 20, alignItems: "flex-start" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-body-sm)",
                    color: "var(--on-tint-body)",
                    flex: "0 0 auto",
                    paddingTop: 2,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="stack" style={{ gap: 6 }}>
                  <h2 style={{ margin: 0, fontSize: "var(--text-heading-4)" }}>{step.title}</h2>
                  <p className="body-sm" style={{ margin: 0, color: "var(--on-tint-body)" }}>
                    {step.body}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card tone="forest" pad="md" radius="lg">
          <p className="body-sm" style={{ margin: 0, color: "var(--forest-200)" }}>
            {t.footer(
              <code style={{ fontFamily: "var(--font-mono)", color: "var(--lime-500)" }}>
                SUPABASE_DB_URL
              </code>,
            )}
          </p>
        </Card>
      </div>
    </main>
  );
}
