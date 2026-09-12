# Kanjikan

Learn Japanese JLPT vocabulary word-first. N5 is built; N4–N1 are structured for but not yet
written.

The premise is that **words, not characters, are the unit of learning**. You meet 日本語 as
something you can say, and the three kanji come along inside it. The kanji screen is a reference
for looking a character up, not a drill.

- **813 N5 words** across **40 themed lessons**
- **All 80 N5 kanji**, each covered by at least one word in the vocabulary
- Spaced repetition with 8 scheduling stages, from ten minutes to three months
- Multi-user accounts with per-lesson resume checkpoints, and lessons open to guests without one
- UI built on the **Atlas Design System** in this repository

---

## Where the data lives

Content and user state are stored differently on purpose.

| | Vocabulary and kanji | Accounts and progress |
|---|---|---|
| **Where** | JSON files in `data/jlpt/` | Supabase Postgres |
| **Why** | Static, identical for every learner, and reviewable as a diff when a reading is wrong. Ships with the app and needs no network. | Mutable, per-user and concurrent. Needs real writes and row-level isolation. |

The tables therefore carry **no foreign key onto a words table**. Progress rows reference a word by
a content-derived id, so content and progress version independently.

### Word ids

`lib/content.ts` derives every id from `(level, lesson slug, word, reading)` with an FNV-1a hash.
This matters:

- Inserting a word in the middle of a lesson leaves every other id untouched.
- The id is reproducible from the JSON alone, so the files and the database cannot drift.
- Moving a word to a different lesson deliberately makes it a new word.

`npm run validate:content` enforces the invariant that actually matters — that
`(lesson, word, reading)` is unique within a level.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

Any region; the free tier is enough. From **Project Settings → API**, copy the Project URL and the
`anon` public key.

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Until both are set, every route redirects to `/setup`, which repeats these steps in the browser.

### 3. Run the migration

Add one more line to `.env.local` — the Postgres connection string, which is **not** the same as
`NEXT_PUBLIC_SUPABASE_URL`. Get it from the **Connect** button at the top of the dashboard, under
*ORMs* or *Connection string*, and copy the URI. Prefer the **Session pooler** one: the direct
`db.<ref>.supabase.co` host is IPv6-only on newer projects and will not connect from most networks.

```
SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

```bash
npm run migrate
```

This applies everything in `supabase/migrations/` in filename order and records what it ran in a
`schema_migrations` table, so it is safe to run repeatedly. Each file goes in its own transaction —
a migration lands whole or not at all.

| | |
|---|---|
| `npm run migrate` | Apply anything not yet applied |
| `npm run migrate -- --dry` | List the files without connecting |
| `npm run migrate -- --redo` | Re-run every file, ignoring the ledger |

It connects straight to Postgres rather than through the REST API, because PostgREST cannot run DDL
— it only exposes tables that already exist. That is why the publishable key is not enough here.

### 4. Turn off email confirmation

**Authentication → Providers → Email.** Switch *Confirm email* **off**. This is required: accounts
are usernames with no real address behind them (see [Authentication](#authentication)), so a
confirmation link would have nowhere to go and no new account could be opened. `npm run doctor`
checks this.

### 5. Run it

```bash
npm run dev
```

---

## Commands

| | |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm run migrate` | Apply `supabase/migrations/*.sql`. Idempotent; tracks applied files in `schema_migrations` |
| `npm run validate:content` | Check the JSON: duplicate ids, kana-only readings, unknown parts of speech, kanji coverage |
| `npm run doctor` | Check the Supabase side: credentials present, project reachable, every table created. Run this first whenever progress is not saving. Prints no secrets. |

---

## Authentication

**Username and password, nothing else.** There is no registration page. `/login` takes a username
and password:

- The username exists and the password matches: you are signed in.
- The username exists and the password does not: *Wrong password for that username.*
- The username does not exist: a dialog says an account will be created with that username and
  password, and creates it only once you confirm.

Usernames are 3–24 letters, numbers, underscores or hyphens, and case-insensitive. New accounts need
a password of at least 8 characters. There is no password reset, because there is no address to
send one to.

Supabase Auth only does password sign-in against an email, so `lib/username.ts` stores each username
as `<username>@kanjikan.internal`. `.internal` is reserved for private networks and never resolves, so
no mail can leave for these addresses. Sign-in cannot tell a wrong password from an unknown user on
its own, so migration `0003_usernames.sql` adds `username_exists()`, a function the anon key may call
that answers that one question and cannot be used to probe other addresses.

Telling the two cases apart means anyone can check whether a username is taken. That is the cost of
the create-on-first-sign-in flow.

### Guest mode

Lessons can be taken without an account. `/lessons`, a lesson page, and its study session are open
to anyone; the landing page offers *Try a Lesson First* and the login page links there too. A guest
gets exactly the same session, but **nothing is saved**: `StudySession` makes no calls to `/api/`,
every lesson starts at the first character, and a strip under the header says so. The end-of-lesson
summary sends them to sign in and back to the same lesson.

Every other page still requires a session. The split is by route group:

| | |
|---|---|
| `app/(app)/` | Signed in only. The layout redirects to `/login`. |
| `app/(open)/` | With or without a session. Currently just `lessons/`. |

Opening a page to guests means moving it into `(open)` **and** adding its path to `GUEST_SECTIONS`
in `middleware.ts`.

Literal HTTP Basic Auth was not used, deliberately: it has no logout, replays credentials on every
request, and gives the server no session to hang per-user progress off. It cannot support the
multi-user progress tracking you asked for in the same sentence.

Isolation is enforced in Postgres, not in application code. Every table has an RLS policy of
`auth.uid() = user_id`, so a bug in a query cannot leak one learner's progress to another.

---

## How the scheduling works

`lib/srs.ts` — one integer of state per word.

| Stage | Next review |
|---|---|
| 1 | 10 minutes |
| 2 | 8 hours |
| 3 | 1 day |
| 4 | 3 days |
| 5 | 1 week — counts as **known** |
| 6 | 2 weeks |
| 7 | 1 month |
| 8 | 3 months — **mastered** |

Correct promotes one stage; wrong demotes two, never below 1. A word counts as *known* once it has
survived a week-long gap, which is the bar the progress screen measures against.

Question type is chosen by stage: meaning first, readings once a word has kanji and a stage above
1, and English-to-Japanese production only at higher stages.

---

## Daily quiz

`/daily-quiz`, reached from a card on the dashboard. Five questions a day — the meaning of a
character — one attempt each.

- **Which kanji.** Only characters first studied *before* today, so the pool holds still all day and
  nothing is asked minutes after it was taught. It unlocks at five, i.e. the day after the first
  lesson.
- **Which five.** A uniform sample, seeded by user and date: the same five on every reload, and not
  biased towards weak characters, since the results are meant to measure retention.
- **Which day.** The learner's own. `TimeZoneScript` writes the browser's zone to a cookie, and the
  server reckons dates in it; without the cookie it falls back to UTC.
- **Grading.** The browser sends only the option picked. The server rebuilds the question and grades
  it, and stores the character, all four options, the answer, the choice, the verdict and the
  character's SRS stage at that moment in `daily_quiz_answers`. RLS allows select and insert but no
  update, so an answer cannot be changed.
- **Not scheduling.** The quiz does not touch `kanji_progress` or `study_sessions`. It records how
  much has stuck without moving the review schedule it is measuring.

Every answer is kept for analysis. To pull them:

```sql
select quiz_date, position, char, answer, chosen, correct, srs_stage, answered_at
from daily_quiz_answers
where user_id = '<uuid>'
order by quiz_date, position;
```

---

## Checkpoints

`lesson_progress.cursor` records how many of a lesson's words have been covered. It is written
every five cards and again when a lesson finishes, so closing the tab halfway through a 20-word
lesson resumes at the right group rather than the start. `profiles.current_lesson_slug` is the
resume target the dashboard offers.

---

## Project layout

```
data/jlpt/n5/
  kanji.json            80 kanji: readings, meanings, stroke counts
  lessons/*.json        40 lessons, hand-editable, grouped by theme
lib/
  content.ts            Loads and indexes the JSON; derives word ids
  srs.ts                Scheduling, mastery bands, streaks
  study.ts              Queue building and distractor selection (pure, seeded)
  daily.ts              The learner's day: time zone cookie, local dates, quiz seed
  progress.ts           Everything that touches the database
components/
  atlas/                Components copied from the Atlas Design System
  app/                  Kanjikan screens
supabase/migrations/    Schema, RLS policies, triggers
scripts/
  migrate.mjs           Applies migrations straight to Postgres
  doctor.mjs            Checks credentials, reachability and that tables exist
  validate-content.mjs  Checks the vocabulary JSON
```

---

## Design system notes

The UI is built on the Atlas Design System in `Atlas Design System/`. Tokens are used as-is and no
values are overridden. Two additions were needed and are flagged in `app/globals.css`:

1. **Noto Sans JP.** Figtree has no CJK coverage, so Japanese set in it falls back to whatever the
   OS chooses and renders differently on every machine. Noto Sans JP is loaded the same way Atlas
   loads its own faces, exposed as `--font-jp`.
2. **Japanese typesetting.** Atlas display type is tracked at `-0.03em`, which crowds kanji strokes
   badly. The `.jp-display` class holds tracking at 0 and opens line-height instead.

The Atlas wordmark is not reproduced. `components/app/Wordmark.tsx` sets *kanjikan* in the display
face at the same `-0.045em` the system specifies for its own.

---

## Content accuracy

The vocabulary was compiled for this project rather than imported from a licensed source. The JLPT
publishes no official vocabulary list, so any N5 list is an informed reconstruction — this one
covers the words consistently taught at N5 and every one of the 80 kanji.

Readings, meanings and parts of speech should be spot-checked against a dictionary before anyone
relies on them for an exam. Corrections are one edit to one JSON file, and
`npm run validate:content` will catch a structural mistake.

Two duplicate surface forms are intentional and reported as warnings: が appears as a conjunction
and as a particle, and 本 as both *book* and the counter for long thin objects.

---

## Adding N4–N1

1. Create `data/jlpt/n4/` with `kanji.json` and `lessons/*.json` in the same shape.
2. Add `"N4"` to `LEVELS` in `lib/content.ts` and to `LEVELS` in `scripts/validate-content.mjs`.

No schema change is needed — `level` is already a column on every table.
