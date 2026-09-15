import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getProfile } from "@/lib/progress";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { ReviewWarningSetting, WritingSetting } from "@/components/app/StudySettings";

export const dynamic = "force-dynamic";

/** How a learner studies. Reached from their name and avatar in the header. */
export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);

  return (
    <div className="stack" style={{ gap: 32, maxWidth: 720 }}>
      <header className="stack" style={{ gap: 16 }}>
        <p className="eyebrow">Settings</p>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-3)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
          }}
        >
          How you study.
        </h1>
        <p style={{ margin: 0, maxWidth: 560 }}>
          Signed in as <strong style={{ color: "var(--text-heading)" }}>{user.username}</strong>. Changes save
          as you make them.
        </p>
      </header>

      <Card tone="white" pad="md" radius="lg" bordered>
        <div className="stack" style={{ gap: 16 }}>
          <div className="stack" style={{ gap: 6 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-heading-3)" }}>Writing</h2>
            <p className="body-sm muted" style={{ margin: 0, maxWidth: 560 }}>
              Reading and writing are tracked separately, so you can learn to read without ever
              drawing a stroke. Switching keeps any writing progress you already have.
            </p>
          </div>
          <WritingSetting initial={profile.study_writing} />
        </div>
      </Card>

      <Card tone="white" pad="md" radius="lg" bordered>
        <div className="stack" style={{ gap: 16 }}>
          <div className="stack" style={{ gap: 6 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-heading-3)" }}>Before a new lesson</h2>
            <p className="body-sm muted" style={{ margin: 0, maxWidth: 560 }}>
              When this many reviews are waiting, starting a lesson first suggests clearing them. It
              never stops you: you can always start anyway.
            </p>
          </div>
          <ReviewWarningSetting initial={profile.review_warning} />
        </div>
      </Card>
    </div>
  );
}
