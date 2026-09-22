/**
 * The browser's side of saving progress: a queue that outlives the network.
 *
 * A study session never waits on the server. Each answer, mark and checkpoint
 * is written to a queue in IndexedDB the moment it happens and the card moves
 * on; the queue is sent to /api/progress/batch in the background, in order, and
 * an event leaves it only once the server says it is applied. A failed send is
 * retried with exponential backoff, and a send is tried again the moment the
 * browser comes back online — so a lesson taken on a train is saved when the
 * train leaves the tunnel, and a tab closed mid-send loses nothing.
 *
 * A guest's progress goes to a store of its own, kanjikan_guest_progress, and
 * is handed to the queue under the account the first time someone signs in
 * (see migrateGuestProgress).
 *
 * Where IndexedDB cannot be opened — some private windows — localStorage takes
 * its place, and failing that memory, which lasts as long as the tab.
 *
 * Browser-only: import it from client components.
 */
import { useSyncExternalStore } from "react";
import {
  SYNC_BATCH_SIZE,
  type SyncBatch,
  type SyncEvent,
  type SyncEventInput,
  type SyncResult,
} from "./sync-events";

/** Events waiting for the server, oldest first. */
export const QUEUE_KEY = "kanjikan_sync_queue";
/** Events made as a guest, oldest first, waiting for an account. */
export const GUEST_KEY = "kanjikan_guest_progress";

/**
 * A queued event and the account it was made under. Null when no account was
 * known yet as it was made, which the next signed-in send claims.
 */
type Queued = { owner: string | null; event: SyncEvent };

/** A guest store past this drops its oldest events: it is for lessons, not for years. */
const GUEST_LIMIT = 5000;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 60_000;

/* ----------------------------------------------------------------------------
 * Storage
 *
 * One operation: read some keys, compute their new values, write them back,
 * atomically. In IndexedDB that is one readwrite transaction, which the
 * browser serialises across tabs, so a send in one tab dropping what it sent
 * cannot drop an answer another tab queued in between.
 * ------------------------------------------------------------------------- */

type Update = (values: unknown[]) => unknown[];

interface Backend {
  update(keys: string[], fn: Update): Promise<unknown[]>;
}

const DB_NAME = "kanjikan";
const STORE = "kv";

function idbBackend(): Backend {
  const opened = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
  return {
    async update(keys, fn) {
      const db = await opened;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const values: unknown[] = new Array(keys.length);
        let next: unknown[] = [];
        let left = keys.length;
        keys.forEach((key, i) => {
          const req = store.get(key);
          req.onsuccess = () => {
            values[i] = req.result;
            if (--left > 0) return;
            next = fn(values);
            next.forEach((v, j) => (v === undefined ? store.delete(keys[j]) : store.put(v, keys[j])));
          };
        });
        tx.oncomplete = () => resolve(next);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      });
    },
  };
}

function localStorageBackend(): Backend {
  // Throws where storage is refused, which is how the caller finds out.
  localStorage.setItem("kanjikan_probe", "1");
  localStorage.removeItem("kanjikan_probe");
  return {
    async update(keys, fn) {
      const values = keys.map((k) => {
        const raw = localStorage.getItem(k);
        return raw === null ? undefined : JSON.parse(raw);
      });
      const next = fn(values);
      next.forEach((v, j) =>
        v === undefined ? localStorage.removeItem(keys[j]) : localStorage.setItem(keys[j], JSON.stringify(v)),
      );
      return next;
    },
  };
}

function memoryBackend(): Backend {
  const map = new Map<string, unknown>();
  return {
    async update(keys, fn) {
      const next = fn(keys.map((k) => map.get(k)));
      next.forEach((v, j) => (v === undefined ? map.delete(keys[j]) : map.set(keys[j], v)));
      return next;
    },
  };
}

let backend: Backend | null = null;

function fallbackBackend(): Backend {
  try {
    return localStorageBackend();
  } catch {
    console.error("[kanjikan] no persistent storage: progress is kept only while this tab is open");
    return memoryBackend();
  }
}

/**
 * Every write goes through this chain, so they apply in the order they were
 * made even on the localStorage fallback, and a send that waits on it sees
 * every event queued before it was asked for.
 */
let writes: Promise<unknown> = Promise.resolve();

function update(keys: string[], fn: Update): Promise<unknown[]> {
  const run = async () => {
    backend ??= typeof indexedDB === "undefined" ? fallbackBackend() : idbBackend();
    try {
      return await backend.update(keys, fn);
    } catch (e) {
      // IndexedDB can fail to open, or fail later (a full disk, a private
      // window that allows opening but not writing). Carry on without it.
      console.error("[kanjikan] IndexedDB failed, falling back", e);
      backend = fallbackBackend();
      return backend.update(keys, fn);
    }
  };
  const result = writes.then(run, run);
  writes = result.catch(() => {});
  return result;
}

const asList = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/* ----------------------------------------------------------------------------
 * State the UI can watch
 * ------------------------------------------------------------------------- */

export type SyncState = {
  /** Events of the signed-in account still waiting for the server. */
  pending: number;
  /** Events made as a guest, waiting for an account. */
  guestPending: number;
  /**
   *   idle        nothing to send, or sent
   *   syncing     a batch is on its way
   *   offline     the browser says there is no network; sends when there is
   *   retrying    the last send failed; tries again after a backoff
   *   signedOut   the server no longer knows this account; sends once signed in
   */
  status: "idle" | "syncing" | "offline" | "retrying" | "signedOut";
};

const INITIAL: SyncState = { pending: 0, guestPending: 0, status: "idle" };
let state: SyncState = INITIAL;
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  const next = { ...state, ...patch };
  if (next.pending === state.pending && next.guestPending === state.guestPending && next.status === state.status) {
    return;
  }
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The queue's state, for a component to show what has and has not reached the server. */
export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

/* ----------------------------------------------------------------------------
 * The account
 * ------------------------------------------------------------------------- */

/** Undefined until the page says who is signed in; null for a guest. */
let user: string | null | undefined;

const mine = (q: Queued) => q.owner === user || q.owner === null;

function count(queue: Queued[], guest: SyncEvent[]) {
  setState({ pending: user ? queue.filter(mine).length : 0, guestPending: guest.length });
}

async function recount() {
  const [queue, guest] = await update([QUEUE_KEY, GUEST_KEY], (v) => v);
  count(asList<Queued>(queue), asList<SyncEvent>(guest));
}

/**
 * Who is signed in on this page, or null for no one. Called by SyncAgent on
 * every page, so events queued under an account wait while it is signed out
 * and are sent the next time it is signed in — and never under anyone else.
 */
export function setSyncUser(id: string | null) {
  if (user === id) return;
  user = id;
  attempt = 0;
  setState({ status: "idle" });
  void recount();
  if (id) void flushSync();
}

/* ----------------------------------------------------------------------------
 * Recording
 * ------------------------------------------------------------------------- */

function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID is only offered on secure origins; a dev server reached over
  // the LAN is not one.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function stamp(input: SyncEventInput): SyncEvent {
  return { ...input, id: uuid(), at: new Date().toISOString() } as SyncEvent;
}

/**
 * Queues one event for the signed-in account and returns at once: nothing
 * here is awaited by the session, so the next card never waits on storage,
 * let alone the network.
 */
export function recordProgress(input: SyncEventInput): void {
  const event = stamp(input);
  const owner = user ?? null;
  update([QUEUE_KEY, GUEST_KEY], ([queue, guest]) => {
    const next = [...asList<Queued>(queue), { owner, event }];
    count(next, asList(guest));
    return [next, guest];
  })
    .then(kick)
    .catch((e) => console.error("[kanjikan] could not queue progress", e));
}

/** Keeps one event of a guest's, for their account to take when they sign in. */
export function recordGuestProgress(input: SyncEventInput): void {
  const event = stamp(input);
  update([QUEUE_KEY, GUEST_KEY], ([queue, guest]) => {
    const next = [...asList<SyncEvent>(guest), event].slice(-GUEST_LIMIT);
    count(asList(queue), next);
    return [queue, next];
  }).catch((e) => console.error("[kanjikan] could not keep guest progress", e));
}

/**
 * Hands everything studied as a guest to this account, and returns how many
 * events that was.
 *
 * The events move into the account's queue and out of the guest store in one
 * transaction, so none is lost or merged twice, and from there the queue sees
 * them to the server like any other. They go in marked as merged, which keeps
 * a lesson the account already finished finished; and an answer older than
 * the account's own last review of that word is passed over by the server
 * (see recordAnswerIn), so the account's own history always wins.
 */
export async function migrateGuestProgress(userId: string): Promise<number> {
  let moved = 0;
  await update([QUEUE_KEY, GUEST_KEY], ([queue, guest]) => {
    const events = asList<SyncEvent>(guest);
    moved = events.length;
    if (moved === 0) return [queue, guest];
    const next = [
      ...asList<Queued>(queue),
      ...events.map((event) => ({ owner: userId, event: { ...event, merged: true } })),
    ];
    count(next, []);
    return [next, undefined];
  });
  if (moved > 0) kick();
  return moved;
}

/* ----------------------------------------------------------------------------
 * Sending
 * ------------------------------------------------------------------------- */

let flushing: Promise<void> | null = null;
let again = false;
let attempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Sends everything this account has queued, a batch at a time, until the
 * queue is empty or a send fails. Only one runs at a time in a tab, and, where
 * the browser has Web Locks, across tabs; asked again while one is running,
 * it runs once more after, to pick up what was queued meanwhile.
 */
export function flushSync(): Promise<void> {
  if (flushing) {
    again = true;
    return flushing;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  flushing = (async () => {
    do {
      again = false;
      await withLock(drain);
    } while (again && state.status !== "retrying");
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/**
 * Sends soon, unless a retry is already waiting out its backoff or the server
 * has said this account is signed out: a new answer is no reason to try again
 * sooner, and would otherwise make every card a request.
 */
function kick() {
  if (!retryTimer && state.status !== "signedOut") void flushSync();
}

function withLock(fn: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks ? locks.request("kanjikan-sync", () => fn()).then(() => undefined) : fn();
}

async function drain(): Promise<void> {
  for (;;) {
    if (!user) return;
    await writes;
    const [queue, guest] = await update([QUEUE_KEY, GUEST_KEY], (v) => v);
    const batch = asList<Queued>(queue).filter(mine).slice(0, SYNC_BATCH_SIZE);
    count(asList(queue), asList(guest));
    if (batch.length === 0) {
      attempt = 0;
      setState({ status: "idle" });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setState({ status: "offline" });
      return;
    }

    setState({ status: "syncing" });
    const body: SyncBatch = { owner: user, sentAt: new Date().toISOString(), events: batch.map((q) => q.event) };
    let result: SyncResult;
    try {
      const res = await fetch("/api/progress/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        // Lets a send started as the tab closes finish. A batch is a few
        // kilobytes, well inside keepalive's 64 KB.
        keepalive: true,
      });
      if (res.status === 401 || res.status === 409) {
        // Kept, not dropped: they go once this account is signed in again.
        setState({ status: "signedOut" });
        return;
      }
      if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
      result = (await res.json()) as SyncResult;
    } catch (e) {
      console.error("[kanjikan] progress sync failed; will retry", e);
      return retryLater();
    }

    const sent = new Set(batch.slice(0, result.done).map((q) => q.event.id));
    await update([QUEUE_KEY, GUEST_KEY], ([q, g]) => {
      const next = asList<Queued>(q).filter((item) => !sent.has(item.event.id));
      count(next, asList(g));
      return [next, g];
    });
    if (result.done < batch.length) {
      console.error(`[kanjikan] progress sync stopped after ${result.done} of ${batch.length}: ${result.error}`);
      return retryLater();
    }
    attempt = 0;
  }
}

/** 1 s, 2 s, 4 s … up to a minute, with jitter so tabs do not retry in step. */
function retryLater() {
  const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt) * (0.5 + Math.random() / 2);
  attempt++;
  setState({ status: "retrying" });
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushSync();
  }, delay);
}

/**
 * Resolves once everything this account queued up to now has reached the
 * server — for a page that should only re-read progress once it is there.
 * Waits as long as that takes, offline included.
 */
export async function whenSynced(): Promise<void> {
  await writes;
  void flushSync();
  await new Promise<void>((resolve) => {
    const check = () => {
      if (state.pending === 0 && state.status !== "syncing") {
        listeners.delete(check);
        resolve();
      }
    };
    listeners.add(check);
    check();
  });
}

/* ----------------------------------------------------------------------------
 * Triggers
 * ------------------------------------------------------------------------- */

let started = false;

/**
 * Sends again when the network returns, when the tab comes back to the
 * front, and as it is hidden or closed. Idempotent.
 */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  const now = () => {
    attempt = 0;
    void flushSync();
  };
  window.addEventListener("online", now);
  window.addEventListener("offline", () => setState({ status: "offline" }));
  window.addEventListener("pagehide", () => void flushSync());
  document.addEventListener("visibilitychange", now);
  void recount();
}
