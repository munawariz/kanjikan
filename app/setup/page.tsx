import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { levelStats } from "@/lib/content";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Wordmark } from "@/components/app/Wordmark";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Create a Supabase project.",
    body: "Any region, free tier is enough. Copy the Project URL and the anon public key from Project Settings, API.",
  },
  {
    title: "Add them to .env.local.",
    body: "Copy .env.example to .env.local, paste both values in, then restart the dev server so Next.js picks them up.",
  },
  {
    title: "Run the migration.",
    body: "Add SUPABASE_DB_URL to .env (the Postgres connection string, from the Connect button), then run npm run migrate. It creates the tables, the row level security policies and the username lookup.",
  },
  {
    title: "Turn off email confirmation.",
    body: "Authentication, Providers, Email: switch off Confirm email. Accounts are usernames with no real address behind them, so a confirmation link would have nowhere to go and no new account could ever be opened.",
  },
];

/**
 * Shown by the middleware whenever Supabase credentials are missing, which is
 * the state of a fresh clone. Content is bundled with the app, so the numbers
 * below are real even before a database exists.
 */
export default function SetupPage() {
  if (isSupabaseConfigured) redirect("/");

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
            Four steps and you are learning.
          </h1>
          <p style={{ margin: 0, maxWidth: 520 }}>
            The {stats.words} N5 words and {stats.kanji} kanji are already in this repository and
            need no setup. Supabase is only there to hold accounts and progress.
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
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            or{" "}
            <code style={{ fontFamily: "var(--font-mono)", color: "var(--lime-500)" }}>
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            is missing. Set both and it redirects to the app on its own.
          </p>
        </Card>
      </div>
    </main>
  );
}
