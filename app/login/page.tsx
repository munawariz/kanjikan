import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthLayout } from "@/components/app/AuthLayout";
import { AuthForm } from "@/components/app/AuthForm";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  // Checked here rather than in the middleware, which cannot tell a live
  // session from a stale cookie.
  if (await getUser()) redirect("/dashboard");

  // A guest sent here from a lesson goes back to that lesson; anyone else
  // lands on the list.
  const next = searchParams.next;
  const guestHref = next === "/lessons" || next?.startsWith("/lessons/") ? next : "/lessons";
  const t = (await getT()).auth.login;

  return (
    <AuthLayout eyebrow={t.eyebrow} title={t.title}>
      <AuthForm next={next} />

      <div style={{ height: 1, background: "var(--border-subtle)", margin: "28px 0 20px" }} />

      <p className="body-sm muted" style={{ margin: 0, textAlign: "center" }}>
        {t.guest(
          <Link href={guestHref} style={{ fontWeight: "var(--weight-semibold)" }}>
            {t.guestLink}
          </Link>,
        )}
      </p>
    </AuthLayout>
  );
}
