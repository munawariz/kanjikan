import { AuthLayout } from "@/components/app/AuthLayout";
import { AuthForm } from "@/components/app/AuthForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <AuthLayout eyebrow="Welcome" title="Sign in or start learning">
      <AuthForm next={searchParams.next} />
    </AuthLayout>
  );
}
