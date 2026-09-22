import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { applyEvent, pruneReceipts } from "@/lib/sync";
import { parseSyncEvent, SYNC_BATCH_SIZE, type SyncResult } from "@/lib/sync-events";

/**
 * Applies a batch of progress events from the browser's queue, in the order
 * they happened (see lib/client-sync.ts).
 *
 * Each event is its own transaction, so one that fails does not undo those
 * before it. The reply says how many from the front are finished with; the
 * browser drops those and retries the rest. Stopping at the first failure,
 * rather than skipping past it, keeps a word's answers in order.
 */
export async function POST(request: Request) {
  const [user, t] = await Promise.all([getUser(), getT()]);
  if (!user) return NextResponse.json({ error: t.api.notSignedIn }, { status: 401 });

  const body = await request.json().catch(() => null);
  const events: unknown = body?.events;
  if (!Array.isArray(events)) {
    return NextResponse.json({ error: "events is required" }, { status: 400 });
  }
  if (events.length > SYNC_BATCH_SIZE) {
    return NextResponse.json({ error: `at most ${SYNC_BATCH_SIZE} events per batch` }, { status: 413 });
  }
  // Queued under another account, which signed out in this browser since. The
  // browser holds them until that account signs in again.
  if (typeof body?.owner === "string" && body.owner !== user.id) {
    return NextResponse.json({ error: "events belong to another account" }, { status: 409 });
  }

  // The browser's clock can be off. Its offset from this one is the same for
  // every event it stamped, so moving each by it puts them on the server's
  // clock — and nothing may be later than now.
  const now = Date.now();
  const sentAt = Date.parse(body?.sentAt);
  const skew = Number.isNaN(sentAt) ? 0 : now - sentAt;

  const result: SyncResult = { done: 0 };
  for (const raw of events) {
    const event = parseSyncEvent(raw);
    if (!event) {
      console.error("[kanjikan] sync: dropped a malformed event", raw);
      result.done++;
      continue;
    }
    try {
      await applyEvent(user.id, event, new Date(Math.min(Date.parse(event.at) + skew, now)));
      result.done++;
    } catch (e) {
      console.error(`[kanjikan] sync: ${event.type} event ${event.id} failed: ${(e as Error).message}`);
      result.error = t.study.save.database;
      break;
    }
  }

  await pruneReceipts(user.id).catch(() => {});
  return NextResponse.json(result);
}
