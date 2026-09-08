"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Field } from "@/components/atlas/forms/Field.jsx";
import { Input } from "@/components/atlas/forms/Input.jsx";
import { signIn, signUp, type AuthState } from "@/app/auth/actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
      {pending ? "One moment…" : label}
    </Button>
  );
}

export function AuthForm({ mode, next }: { mode: "signin" | "signup"; next?: string }) {
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction] = useFormState<AuthState, FormData>(action, {});

  return (
    <form action={formAction} className="stack" style={{ gap: 20 }}>
      {next && <input type="hidden" name="next" value={next} />}

      {mode === "signup" && (
        <Field label="Your name" htmlFor="display_name" hint="Shown on your progress page.">
          <Input id="display_name" name="display_name" autoComplete="name" placeholder="Rina" />
        </Field>
      )}

      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        hint={mode === "signup" ? "At least 8 characters." : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          placeholder="••••••••"
        />
      </Field>

      {state.error && (
        <p
          role="alert"
          className="body-sm"
          style={{
            margin: 0,
            padding: "12px 16px",
            borderRadius: "var(--radius-input)",
            background: "var(--negative-100)",
            color: "var(--negative-600)",
          }}
        >
          {state.error}
        </p>
      )}

      {state.notice && (
        <p
          role="status"
          className="body-sm"
          style={{
            margin: 0,
            padding: "12px 16px",
            borderRadius: "var(--radius-input)",
            background: "var(--lime-200)",
            color: "var(--forest-800)",
          }}
        >
          {state.notice}
        </p>
      )}

      <Submit label={mode === "signin" ? "Sign In" : "Create Account"} />

      <p className="body-sm muted" style={{ margin: 0, textAlign: "center" }}>
        {mode === "signin" ? (
          <>
            No account yet? <Link href="/signup">Create one</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        )}
      </p>
    </form>
  );
}
