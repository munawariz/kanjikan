import Link from "next/link";
import { AuthLayout } from "@/components/app/AuthLayout";
import { AuthForm } from "@/components/app/AuthForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  // A guest sent here from a lesson goes back to that lesson; anyone else
  // lands on the list.
  const next = searchParams.next;
  const guestHref = next === "/lessons" || next?.startsWith("/lessons/") ? next : "/lessons";

  return (
    <AuthLayout eyebrow="Welcome" title="Sign in or start learning">
      <AuthForm next={next} />

      <div style={{ height: 1, background: "var(--border-subtle)", margin: "28px 0 20px" }} />

      <p className="body-sm muted" style={{ margin: 0, textAlign: "center" }}>
        Not ready for an account?{" "}
        <Link href={guestHref} style={{ fontWeight: "var(--weight-semibold)" }}>
          Take lessons as a guest
        </Link>
        . Nothing you answer will be saved.
      </p>
    </AuthLayout>
  );
}
