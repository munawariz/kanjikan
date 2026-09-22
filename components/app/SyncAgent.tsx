"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { migrateGuestProgress, setSyncUser, startSync, whenSynced } from "@/lib/client-sync";

/**
 * Keeps the progress queue running on every page (see lib/client-sync.ts):
 * tells it who is signed in, so what is queued goes under the right account,
 * and sends whatever is left from an earlier visit.
 *
 * Also where a guest's progress joins their account. The first page after
 * signing in or signing up finds it, hands it to the queue, and once it has
 * reached the server re-reads the page, so the lessons and reviews studied as
 * a guest show at once.
 *
 * Rendered by AppFrame ahead of the page, so its effect runs before the
 * page's own and the account is known before anything is studied.
 */
export function SyncAgent({ userId }: { userId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    startSync();
    setSyncUser(userId);
    if (!userId) return;

    let alive = true;
    migrateGuestProgress(userId)
      .then(async (moved) => {
        if (moved === 0) return;
        await whenSynced();
        if (alive) router.refresh();
      })
      .catch((e) => console.error("[kanjikan] could not merge guest progress", e));
    return () => {
      alive = false;
    };
  }, [userId, router]);

  return null;
}
