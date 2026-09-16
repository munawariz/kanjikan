"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/atlas/core/Button.jsx";
import type { MarkState } from "@/lib/srs";
import { post } from "./StudySession";
import { useT } from "@/lib/i18n/client";

/**
 * "I already know this" for a word, a kanji or a lesson, and its undo.
 *
 * Shows the mark while there is something below known to mark, and the undo
 * while anything is marked; a lesson half marked shows both. What a mark does
 * is decided on the server (see /api/mark); this only asks and then refreshes
 * the page so every figure on it moves together.
 */
export function MarkControl({
  scope,
  id,
  skill,
  state,
  markLabel,
  markedLabel,
  title,
  onTint = false,
}: {
  scope: "word" | "kanji" | "lesson";
  id: string;
  skill: "reading" | "writing";
  state: MarkState;
  markLabel: string;
  /** Said beside the undo. Omit where the mark already shows nearby. */
  markedLabel?: string;
  title?: string;
  /** On a cream or sage card, where the muted text colour needs the tinted variant. */
  onTint?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.markable === 0 && state.marked === 0) return null;

  async function send(undo: boolean) {
    setBusy(true);
    setError(null);
    const ok = await post("/api/mark", { scope, id, skill, undo }, setError);
    setBusy(false);
    if (ok) startTransition(() => router.refresh());
  }

  const working = busy || pending;
  const muted = onTint ? "var(--on-tint-body)" : "var(--text-muted)";

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      {state.markable > 0 && (
        <Button variant="outline" size="sm" onClick={() => send(false)} disabled={working} title={title}>
          {markLabel}
        </Button>
      )}
      {state.marked > 0 && (
        <>
          {markedLabel && (
            <span className="body-sm" style={{ color: muted }}>
              {markedLabel}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => send(true)} disabled={working}>
            {t.shell.undo}
          </Button>
        </>
      )}
      {error && (
        <span role="alert" className="body-sm" style={{ color: "var(--negative-600)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
