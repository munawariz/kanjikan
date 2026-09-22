-- Receipts for progress synced from the browser's queue.
--
-- The browser keeps every answer, mark and checkpoint in a local queue and
-- sends it to /api/progress/batch, retrying until the server confirms it (see
-- lib/client-sync.ts). A request can land and its response still be lost — a
-- dropped connection, a tab closed mid-flight — so the same event can arrive
-- twice. Each event carries an id the browser made, and applying it inserts
-- that id here in the same transaction: the second arrival finds its receipt
-- and changes nothing, so an answer is never graded twice.
--
-- A receipt only has to outlive the retries of its event. lib/sync.ts prunes
-- those older than 30 days as it writes new ones.

create table if not exists public.sync_receipts (
  user_id    uuid not null references public.accounts (id) on delete cascade,
  event_id   uuid not null,
  applied_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists sync_receipts_user_time_idx
  on public.sync_receipts (user_id, applied_at);

alter table public.sync_receipts enable row level security;

drop policy if exists "own sync receipts" on public.sync_receipts;
create policy "own sync receipts" on public.sync_receipts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
