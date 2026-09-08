import { AuthLayout } from "@/components/app/AuthLayout";
import { AuthForm } from "@/components/app/AuthForm";

export const metadata = { title: "Sign in — Kanjikan" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <AuthLayout eyebrow="Welcome back" title="Sign in to keep going">
      <AuthForm mode="signin" next={searchParams.next} />
    </AuthLayout>
  );
}
