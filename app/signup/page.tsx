import { AuthLayout } from "@/components/app/AuthLayout";
import { AuthForm } from "@/components/app/AuthForm";

export const metadata = { title: "Create an account — Kanjikan" };

export default function SignupPage() {
  return (
    <AuthLayout eyebrow="Get started" title="Create your account">
      <AuthForm mode="signup" />
    </AuthLayout>
  );
}
