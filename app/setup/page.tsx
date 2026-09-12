import { redirect } from "next/navigation";
import { isDatabaseConfigured } from "@/lib/db";
import { levelStats } from "@/lib/content";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Wordmark } from "@/components/app/Wordmark";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Create a Supabase project.",
    body: "Any region; the free tier is enough. Kanjikan only uses its Postgres database — accounts are kept in the app's own tables, not in Supabase Auth.",
  },
  {
    title: "Add the database URL to .env.",
    body: "From the Connect button at the top of the dashboard, copy the Session pooler connection string and set it as SUPABASE_DB_URL in .env. Then restart the dev server so Next.js picks it up.",
  },
  {
    title: "Run the migration.",
    body: "npm run migrate creates the tables, the accounts and sessions, and the row level security policies. npm run doctor checks the result.",
  },
];

/**
 * Shown by the middleware whenever the database URL is missing, which is the
 * state of a fresh clone. Content is bundled with the app, so the numbers
 * below are real even before a database exists.
 */
export default function SetupPage() {
  if (isDatabaseConfigured) redirect("/");

  const stats = levelStats("N5");

  return (
    <main className="page" style={{ paddingTop: 64, paddingBottom: 96, maxWidth: 760 }}>
      <div className="stack" style={{ gap: 32 }}>
        <Wordmark size={24} />

        <div className="stack" style={{ gap: 16 }}>
          <Badge tone="warning">Not configured yet</Badge>
          <h1
            style={{
              margin: 0,
              fontSize: "var(--text-display-3)",
              letterSpacing: "var(--tracking-display)",
              lineHeight: "var(--leading-display)",
            }}
          >
            Three steps and you are learning.
          </h1>
          <p style={{ margin: 0, maxWidth: 520 }}>
            The {stats.words} N5 words and {stats.kanji} kanji are already in this repository and
            need no setup. The database is only there to hold accounts and progress.
          </p>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          {STEPS.map((step, i) => (
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
            This page is served whenever{" "}
            <code style={{ fontFamily: "var(--font-mono)", color: "var(--lime-500)" }}>
              SUPABASE_DB_URL
            </code>{" "}
            is missing. Set it and restart, and it redirects to the app on its own.
          </p>
        </Card>
      </div>
    </main>
  );
}
