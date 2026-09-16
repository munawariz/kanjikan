"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Field } from "@/components/atlas/forms/Field.jsx";
import { Input } from "@/components/atlas/forms/Input.jsx";
import { authenticate, type AuthState } from "@/app/auth/actions";
import { PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN } from "@/lib/username";
import { useT } from "@/lib/i18n/client";

function Submit({ label, ...rest }: { label: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  const t = useT().auth.form;
  return (
    <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending} {...rest}>
      {pending ? t.pending : label}
    </Button>
  );
}

export function AuthForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState<AuthState, FormData>(authenticate, {});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const t = useT().auth.form;

  // Every submission returns a fresh state object, so this runs once per
  // answer: it opens the prompt for a free username, and closes it when the
  // create attempt comes back with an error to show on the form.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (state.confirmCreate && !dialog.open) dialog.showModal();
    if (!state.confirmCreate && dialog.open) dialog.close();
  }, [state]);

  return (
    <form action={formAction} className="stack" style={{ gap: 20 }}>
      {next && <input type="hidden" name="next" value={next} />}

      <Field
        label={t.username}
        htmlFor="username"
        required
        hint={t.usernameHint}
      >
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={USERNAME_MIN}
          maxLength={USERNAME_MAX}
          pattern="[A-Za-z0-9_\-]+"
          placeholder="rina"
        />
      </Field>

      <Field
        label={t.password}
        htmlFor="password"
        required
        hint={t.passwordHint(PASSWORD_MIN)}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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

      <Submit label={t.submit} />

      <p className="body-sm muted" style={{ margin: 0, textAlign: "center" }}>
        {t.newHere}
      </p>

      {/* Must come after the main submit button. Pressing Enter in a field
          clicks the form's first submit button in document order, even one
          inside a closed dialog, and that would create an account unasked. */}
      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="create-account-title"
        aria-describedby="create-account-body"
      >
        <div className="stack" style={{ gap: 20 }}>
          <div className="stack" style={{ gap: 10 }}>
            <p className="eyebrow" style={{ margin: 0 }}>
              {t.dialogEyebrow}
            </p>
            <h3
              id="create-account-title"
              style={{ margin: 0, fontSize: "var(--text-heading-2)", letterSpacing: "var(--tracking-heading)" }}
            >
              {t.dialogTitle}
            </h3>
          </div>

          <div id="create-account-body" className="stack" style={{ gap: 10 }}>
            <p style={{ margin: 0 }}>
              {t.dialogBody(<strong style={{ color: "var(--text-heading)" }}>{state.confirmCreate}</strong>)}
            </p>
            <p className="body-sm muted" style={{ margin: 0 }}>
              {t.dialogNote}
            </p>
          </div>

          {/* showModal() focuses the first focusable element, which is this. */}
          <div className="stack" style={{ gap: 10 }}>
            <Submit label={t.create} name="intent" value="create" />
            <Button variant="ghost" size="lg" fullWidth onClick={() => dialogRef.current?.close()}>
              {t.cancel}
            </Button>
          </div>
        </div>
      </dialog>
    </form>
  );
}
