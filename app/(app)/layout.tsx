import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getDueCount, getProfile } from "@/lib/progress";
import { signOut } from "@/app/auth/actions";
import { AppShell } from "@/components/app/AppShell";

/**
 * Everything under (app) requires a session. The middleware already redirects
 * anonymous traffic; this second check is what makes that guarantee hold if the
 * matcher is ever narrowed.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const [profile, dueCount] = await Promise.all([getProfile(user.id), getDueCount()]);
  const name = profile.display_name || user.email?.split("@")[0] || "Learner";

  return (
    <AppShell
      name={name}
      dueCount={dueCount}
      signOut={
        <form action={signOut}>
          <button
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: "var(--radius-full)",
              border: "1px solid var(--border-default)",
              background: "transparent",
              color: "var(--text-heading)",
              cursor: "pointer",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
