import type { User } from "@supabase/supabase-js";
import { getDueCount, getProfile } from "@/lib/progress";
import { signOut } from "@/app/auth/actions";
import { AppShell } from "./AppShell";

/**
 * The shell with its account half filled in — or left empty for a guest, who
 * gets a sign-in button in its place. Shared by both route groups, so a lesson
 * page looks the same whether or not anyone is signed in.
 */
export async function AppFrame({ user, children }: { user: User | null; children: React.ReactNode }) {
  if (!user) return <AppShell account={null}>{children}</AppShell>;

  const [profile, dueCount] = await Promise.all([getProfile(user.id), getDueCount()]);
  const name = profile.display_name || user.email?.split("@")[0] || "Learner";

  return (
    <AppShell
      account={{
        name,
        dueCount,
        signOut: (
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
        ),
      }}
    >
      {children}
    </AppShell>
  );
}
