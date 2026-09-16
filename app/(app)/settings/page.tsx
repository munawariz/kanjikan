import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getProfile } from "@/lib/progress";
import { getLocale, getT } from "@/lib/i18n/server";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { LanguageSetting, ReviewWarningSetting, WritingSetting } from "@/components/app/StudySettings";

export const dynamic = "force-dynamic";

/** One setting: what it is, what it does, and the control. */
function Section({ heading, body, children }: { heading: string; body: string; children: React.ReactNode }) {
  return (
    <Card tone="white" pad="md" radius="lg" bordered>
      <div className="stack" style={{ gap: 16 }}>
        <div className="stack" style={{ gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-heading-3)" }}>{heading}</h2>
          <p className="body-sm muted" style={{ margin: 0, maxWidth: 560 }}>
            {body}
          </p>
        </div>
        {children}
      </div>
    </Card>
  );
}

/** How a learner studies. Reached from their name and avatar in the header. */
export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [profile, locale, t] = await Promise.all([getProfile(user.id), getLocale(), getT()]);

  return (
    <div className="stack" style={{ gap: 32, maxWidth: 720 }}>
      <header className="stack" style={{ gap: 16 }}>
        <p className="eyebrow">{t.settings.eyebrow}</p>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-3)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
          }}
        >
          {t.settings.title}
        </h1>
        <p style={{ margin: 0, maxWidth: 560 }}>
          {t.settings.signedInAs} <strong style={{ color: "var(--text-heading)" }}>{user.username}</strong>.{" "}
          {t.settings.savesAsYouGo}
        </p>
      </header>

      <Section heading={t.settings.language.heading} body={t.settings.language.body}>
        {/* The language in effect, which is the saved one once there is one. */}
        <LanguageSetting initial={locale} />
      </Section>

      <Section heading={t.settings.writing.heading} body={t.settings.writing.body}>
        <WritingSetting initial={profile.study_writing} />
      </Section>

      <Section heading={t.settings.warning.heading} body={t.settings.warning.body}>
        <ReviewWarningSetting initial={profile.review_warning} />
      </Section>
    </div>
  );
}
