# Kanjikan

Learn Japanese JLPT vocabulary word-first. N5 and N4 are built; N3–N1 are structured for but not
yet written.

The premise is that **words, not characters, are the unit of learning**. You meet 日本語 as
something you can say, and the three kanji come along inside it. The kanji screen is a reference
for looking a character up, not a drill.

- **N5**: all 80 kanji in 16 lessons, with 380 words
- **N4**: all 166 kanji in 33 lessons, with 873 words
- Every kanji taught by at least four words that fix its readings
- Spaced repetition with 8 scheduling stages, from ten minutes to three months
- Multi-user accounts with per-lesson resume checkpoints, and lessons open to guests without one
- In **English** or **Indonesian**: the interface, meanings, lesson notes and memory stories
- UI built on the **Atlas Design System** in this repository

> **Kanjikan is community-supported, and you can help without writing code.** Fix a meaning, add a
> word, write a better memory story, or translate the app into your language. Most changes are one
> JSON file. See **[Contributing](#contributing)**.

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

### One curriculum, several levels

Levels are not separate courses. `lib/content.ts` loads every built level in study order and runs
them together:

- **Lessons are numbered straight through.** N5 is lessons 1–16 and N4 carries on from 17, so a
  lesson number means the same thing on every page.
- **Parts carry over.** An N4 kanji is built from pieces met in N5 — 体 is 亻 and 本 — and its
  lesson card says where each was first seen, even when that was in an earlier level.
- **Nothing is per level except where it has to be.** Review, the daily quiz, the Kanji page and
  Home cover every level at once, so a learner working through N4 keeps getting their N5 words back.
  Home's headline figure is the kanji known in the level being worked through.

A kanji, a lesson slug and a word each belong to one level only, and the validator checks it. That
is why a lesson's address and a progress row need no level of their own.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project and connect it

Any region; the free tier is enough. Kanjikan uses only its Postgres database — not Supabase Auth,
and not the REST API.

From the **Connect** button at the top of the dashboard, under *ORMs* or *Connection string*, copy the
URI. Use the **Transaction pooler** one (port `6543`). On Vercel every function instance opens its own
connections, and the Session pooler (port `5432`) ties up one of the project's pooled Postgres
connections for each, even while idle, so a few instances exhaust the pool and requests start failing.
The Transaction pooler holds one only while a transaction runs, and the app does all its work in
transactions. The direct `db.<ref>.supabase.co` host is IPv6-only on newer projects and will not
connect from most networks.

```bash
cp .env.example .env
```

```
SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

This is the only setting, and it is a **secret**: it is used on the server, never sent to the
browser, and must also be set wherever the app is deployed. Until it is set, the home page, lessons
and practice work as they do for a guest, and everything that needs an account redirects to
`/setup`, which repeats these steps in the browser.

### 3. Run the migration

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

### 4. Run it

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
| `npm run validate:content` | Check the content: duplicate ids, kana-only readings, unknown parts of speech, kanji coverage, parts and stories, and that every language is complete. `-- --locale xx` also lists what language `xx` still lacks |
| `npm run doctor` | Check the database: reachable, every table created with row level security on, accounts and sessions closed to the API. Run this first whenever progress is not saving. Prints no secrets. |

---

## Authentication

**Username and password, nothing else.** There is no registration page. `/login` takes a username
and password:

- The username exists and the password matches: you are signed in.
- The username exists and the password does not: *Wrong password for that username.*
- The username does not exist: a dialog says an account will be created with that username and
  password, and creates it only once you confirm.

Usernames are 3–24 letters, numbers, underscores or hyphens, and case-insensitive. New accounts need
a password of 8 to 72 characters. There is no password reset, because there is no address to send
one to.

**No email is stored anywhere.** Accounts do not use Supabase Auth, which cannot do password sign-in
without an email or phone number — and which rejected the stand-in addresses an earlier version
invented for it. Instead (`lib/auth.ts`, migration `0005_accounts.sql`):

- `accounts` holds a username and a bcrypt hash of the password.
- Signing in creates a row in `sessions` and an httpOnly cookie holding a random token. The table
  keeps only the token's SHA-256, so reading it does not let anyone sign in.
- Ten wrong passwords in a row lock a username for fifteen minutes.
- Neither table is reachable through Supabase's REST API: row level security is on with no policies,
  and the API roles have no grants on them.

Telling a wrong password apart from an unknown username means anyone can check whether a username is
taken. That is the cost of the create-on-first-sign-in flow; the lockout is what stops it being a
free way to guess passwords.

Accounts from the Supabase Auth era were carried over by `0005_accounts.sql` with the same id, so
their progress stayed attached, and the same password. Their username is the part of the old email
address before the @.

### Guest mode

Lessons can be taken without an account. `/lessons`, a lesson page, and its study session are open
to anyone; the landing page offers *Start with Lesson 1* and the login page links there too. A guest
gets exactly the same session, but **nothing is saved**: `StudySession` makes no calls to `/api/`,
every lesson starts at the first character, and a strip under the header says so. The end-of-lesson
summary sends them to sign in and back to the same lesson.

`/practice` is open too. There anyone picks kanji — single characters or a whole level — and what to
drill (reading, writing), and runs a session that is never saved for anyone, signed in or not: it does
not touch progress, reviews, streaks or the session history. A guest's nav shows only Lessons and
Practice.

Every other page still requires a session. The split is by route group:

| | |
|---|---|
| `app/(app)/` | Signed in only. The layout redirects to `/login`. |
| `app/(open)/` | With or without a session: `lessons/` and `practice/`. |

Opening a page to guests means moving it into `(open)` **and** adding its path to `GUEST_SECTIONS`
in `middleware.ts`. Guest pages also work with no database configured at all, which is what lets a
contributor check a content change without one.

Literal HTTP Basic Auth was not used, deliberately: it has no logout, replays credentials on every
request, and gives the server no session to hang per-user progress off. It cannot support the
multi-user progress tracking you asked for in the same sentence.

Isolation is enforced in Postgres, not in application code. Every table has an RLS policy of
`auth.uid() = user_id`, and the app connects to Postgres directly (`lib/db.ts`) and runs each
learner's queries in a transaction as the `authenticated` role, with the claims that make
`auth.uid()` their account id. So a bug in a query cannot leak one learner's progress to another.

---

## How mastery works

**Words are the unit of reading.** Every word has a stage from 0 to 8 (below), and it is the only
reading score stored. A kanji has none of its own: it is as readable as the words that teach it.
`kanjiReading` in `lib/srs.ts` gives it the stage *most* of those words have reached, so **a kanji
counts as known once most of its words are known**, and reviewing 日本語 strengthens 語. Every figure
that says how many kanji are known — Home, the lesson pages, the Kanji page — comes from that rule.

A lesson still asks what each kanji means, as a warm-up straight after it is introduced, but that
answer is not recorded: the word questions that follow are what count.

**Writing is a separate, optional track.** Each learner chooses *reading only* or *reading and
writing* (Home asks once; Settings changes it). With writing on, each lesson character ends on the
writing pad, and its writing has its own stage and its own due date in `kanji_progress`, reviewed
through Review alongside words. With it off, nothing about writing is asked or shown. Switching
keeps what is stored either way.

**"I already know this."** A word, a kanji (its words) or a whole lesson can be marked known, from
the lesson page, the Kanji page, or the teaching cards during a lesson; writing likewise, by kanji
or by lesson. A mark puts the item at stage 5, due in a week for one check. The state before the
mark is kept beside it, so it can be undone exactly until that first check, which settles it like
any other answer. Lessons leave marked words, and marked writing, out entirely.

**Suggested order, never enforced.** Home's Continue button goes to Review when anything is due,
then to the lesson in hand, then the next. Starting a lesson with at least the learner's threshold
of reviews due (20 by default, adjustable or off in Settings) shows a "review first?" screen with a
Start Anyway button. Nothing is ever locked.

## How the scheduling works

`lib/srs.ts` — one integer of state per word, and per character's writing.

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
survived a week-long gap, which is the bar Home measures against.

Question type is chosen by stage: meaning first, readings once a word has kanji and a stage above
1, and English-to-Japanese production only at higher stages.

---

## Daily quiz

`/daily-quiz`, reached from a card on the dashboard. Five questions a day — the meaning of a
character — one attempt each.

- **Which kanji.** Only characters first studied *before* today — the day the first of a
  character's words was answered or marked known — so the pool holds still all day and nothing is
  asked minutes after it was taught. It unlocks at five, i.e. the day after the first lesson.
  Characters of every level count.
- **Which five.** A uniform sample, seeded by user and date: the same five on every reload, and not
  biased towards weak characters, since the results are meant to measure retention. The wrong
  options come from the levels the learner has learned something in, so an N5 learner is never
  offered N4 meanings they could rule out for being unfamiliar.
- **Which day.** The learner's own. `TimeZoneScript` writes the browser's zone to a cookie, and the
  server reckons dates in it; without the cookie it falls back to UTC.
- **Grading.** The browser sends only the option picked. The server rebuilds the question and grades
  it, and stores the character, all four options, the answer, the choice, the verdict and the
  character's SRS stage at that moment in `daily_quiz_answers`. RLS allows select and insert but no
  update, so an answer cannot be changed.
- **Not scheduling.** The quiz does not touch any progress table or `study_sessions`. It records how
  much has stuck without moving the review schedule it is measuring. The `srs_stage` it stores is the
  character's reading stage worked out from its words; answers from before migration
  `0006_word_mastery.sql` hold the old, separately stored recognition stage.

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
data/jlpt/
  levels.json           The N5-to-N1 roadmap: estimated kanji counts
  STROKES-LICENSE.md    Attribution for the stroke data
  n5/, n4/              The curriculum, one directory per built level, the same in every language:
    kanji.json            Characters, readings, stroke counts
    parts.json            Each kanji's radical and parts, and the primitives they are built from
    lessons/*.json        Lessons: which kanji each teaches, and the words that teach them
    strokes.json          Stroke order, from KanjiVG
  locales/              What a learner reads, one directory per language:
    en/                   English, the reference every other language is checked against
      levels.json           Each level's title and description
      n5/, n4/              Mirrors the curriculum:
        kanji.json            Kanji meanings
        mnemonics.json        Memory stories, part roles, primitive meanings
        lessons/*.json        Lesson titles and summaries, word meanings
    id/                   Indonesian, the same shape, plus its style guide (README.md)
lib/
  content.ts            Loads and indexes the JSON; derives word ids
  srs.ts                Scheduling, mastery bands, streaks
  study.ts              Queue building and distractor selection (pure, seeded)
  daily.ts              The learner's day: time zone cookie, local dates, quiz seed
  db.ts                 The Postgres pool; runs queries as one learner, under RLS
  auth.ts               Accounts, passwords, sessions
  progress.ts           Everything about a learner's progress
  i18n/                 Languages: the locale setting and every interface string
components/
  atlas/                Components copied from the Atlas Design System
  app/                  Kanjikan screens
supabase/migrations/    Schema, RLS policies, triggers
scripts/
  migrate.mjs           Applies migrations straight to Postgres
  doctor.mjs            Checks the database: tables, row level security, access
  validate-content.mjs  Checks the curriculum and every language against it
  title-case.mjs        The Title Case rule meanings are written in, per language
```

---

## Languages

The app runs in English and Indonesian. Japanese is the language being learned, so it is never one
the app itself is shown in.

- **Choosing.** A learner picks a language in Settings, and it is saved on their profile
  (`profiles.locale`, migration `0007`). A guest switches with the EN/ID button in the header, and
  the choice is kept in a cookie. A new account starts in the language chosen before signing up.
- **Interface strings** live in `lib/i18n/messages/`, one file per area, each exporting
  `{ en, id }`. `id` is typed as `typeof en`, so a string missing in Indonesian fails `tsc`. Server
  components use `getT()` from `lib/i18n/server`; client components use `useT()` from
  `lib/i18n/client`.
- **Content** is split in two:
  - The curriculum (`data/jlpt/<level>/`) holds what is the same in every language.
  - Each language has its own tree (`data/jlpt/locales/<locale>/`) with everything a learner reads.
  - `lib/content.ts` joins the two, falling back to English for anything a language lacks.
  - Every content accessor takes a locale and defaults to English. Grading and progress need only
    ids and characters, so they leave it out.
- **Progress does not depend on language.** Word ids come from the curriculum alone. The daily
  quiz is chosen from the English and only labelled in the learner's language, so switching
  languages mid-day changes nothing.
- **Completeness is checked.** `npm run validate:content` fails if a language the app ships is
  missing any text for a built level, or if one of its memory stories leaves out a part. A language
  that isn't shipped yet only gets a progress report; see
  [Translating into a new language](#translating-into-a-new-language).

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
has published no official kanji or vocabulary list since 2010, so every level here is an informed
reconstruction. The kanji are the widely used community lists — 80 for N5, 166 for N4 — and the
words are ones consistently taught at each level, chosen so that every kanji has at least four.
An N4 word uses only N5 kanji and N4 kanji already taught, apart from a few standard words that
are always written with a character from a later level (部屋, 田舎).

Readings, meanings and parts of speech should be spot-checked against a dictionary before anyone
relies on them for an exam. A correction is usually one edit to one JSON file (see
[Contributing](#contributing)), and `npm run validate:content` will catch a structural mistake.

### How meanings are written

**A kanji's meanings are only what the kanji means by itself.** 火 is *Fire* — not *Tuesday*, which
is 火曜日, and not *Fireworks*, which is 花火. Those meanings belong to the words, and the words teach
them. A sense the kanji carries wherever it appears stays, including as a counter, prefix or suffix:
分 *Minute*, 円 *Yen*, 毎 *Every*, 語 *Language* (日本語). What goes is the meaning of one particular
word: 日 *Japan* (日本), 分 *Understand* (分かる), 休 *Day Off* (休み). A few kanji — 午, 電, 校 —
are almost never a word on their own, but *Noon*, *Electricity* and *School* are still what they mean.
This takes judgement, so it is not checked automatically.

**Every meaning is in Title Case**: *Fire*, *Ten Thousand*, *Coming to Japan*. Short joining words stay
lowercase inside a phrase, and qualifiers in parentheses stay as written: *Father (polite)*.
`scripts/title-case.mjs` is the rule, and `npm run validate:content` fails on any meaning — kanji,
word, part or role — that does not follow it.

### Radicals, parts and mnemonics

Every kanji has three things, shown when a lesson introduces it, on the lesson page, and in the kanji
browser. The first two are the same in every language and live in `data/jlpt/<level>/parts.json`;
the story is written per language in `locales/<locale>/<level>/mnemonics.json`.

- **radical** — the dictionary (Kangxi) radical, as Japanese dictionaries file the character. This
  overrides the radical in `strokes.json`: KanjiVG sometimes records a stroke there instead, giving
  丿 for 年, 東, 来, 千 and 午, which dictionaries file under 干, 木, 木, 十 and 十.
- **parts** — the pieces you can see and reuse. Each is either a kanji of any level or a primitive,
  listed under `primitives` in `parts.json` (with its Japanese name, if it has one) and given a
  meaning in each language's `mnemonics.json`. A part listed under a kanji's `roles` plays a
  different part in that one kanji: 人 is the lid in 食. Each language names that role. A primitive
  is defined once, by the first level that uses it: N4's file adds only what N5's lacked.
- **mnemonic** — a one- or two-sentence story that uses every part. One that says *once a picture
  of* describes the character's real origin; the rest are memory aids, not etymology.

A lesson card marks the parts a learner has not met before and explains them, and says where the rest
were first seen. `npm run validate:content` checks that every kanji has an entry, that every part
and radical is defined, and that every part appears in its story.

Two duplicate surface forms are intentional and reported as warnings: が appears as a conjunction
and as a particle, and 本 as both *book* and the counter for long thin objects.

---

## Contributing

Kanjikan is built and maintained by its community. Every meaning, word, memory story and
translation here can be improved by anyone, and most improvements are an edit to a single JSON file
with no code involved.

### Ways to help

| You want to… | Where | Guide |
|---|---|---|
| Report a mistake without editing anything | A GitHub issue | [Reporting a mistake](#reporting-a-mistake) |
| Fix a meaning, title or summary | `data/jlpt/locales/<locale>/<level>/` | [Fixing text](#fixing-a-meaning-a-lesson-title-or-a-summary) |
| Fix a reading or a stroke count | `data/jlpt/<level>/kanji.json`, `lessons/*.json` | [Fixing Japanese](#fixing-a-reading-or-other-japanese) |
| Add, move or remove a word | `data/jlpt/<level>/lessons/*.json`, plus every language | [Words](#adding-or-changing-a-word) |
| Write a better memory story | `data/jlpt/locales/<locale>/<level>/mnemonics.json` | [Memory stories](#improving-a-memory-story) |
| Correct a radical or a kanji's parts | `data/jlpt/<level>/parts.json` | [Parts](#changing-a-radical-or-a-kanjis-parts) |
| Improve an existing translation | `data/jlpt/locales/<locale>/`, `lib/i18n/messages/` | [Translating](#improving-a-translation) |
| Translate the app into a new language | A new `data/jlpt/locales/<locale>/` | [New language](#translating-into-a-new-language) |
| Build N3, N2 or N1 | A new `data/jlpt/<level>/` | [New level](#adding-a-level) |
| Fix a bug or build a feature | `app/`, `components/`, `lib/` | [Code](#changing-code) |

### Getting set up

```bash
git clone <your fork>
cd kanjikan
npm install
npm run validate:content    # the check every content change must pass
npm run dev                 # http://localhost:3000
```

**You don't need a database to check a content change.** Without one, the home page, lessons and
practice all work as they do for a guest, in every language: use the EN/ID button in the header to
switch. Signing in, reviews and the dashboard need the database described under [Setup](#setup).

Work on a branch and open a pull request. In the description, say what you changed and why, and
link a dictionary entry or another source for any change to readings or meanings.

### How the content is organised

The content is split in two, and most changes touch only one side:

- **`data/jlpt/<level>/` is the curriculum.** It holds what is true in every language: which kanji a
  level has, their readings and stroke counts, their parts, which lesson teaches each one, and the
  words that teach them. There is no English in it.
- **`data/jlpt/locales/<locale>/` is what a learner reads, one folder per language.** It holds
  meanings, lesson titles and summaries, memory stories and level descriptions. Each language's
  folder mirrors the curriculum file for file.
- **English (`locales/en/`) is the reference.** Every other language must have an entry for
  everything English has.

Every text file is keyed by something in the curriculum:

| File | Keyed by | Shape |
|---|---|---|
| `locales/<l>/levels.json` | level | `{ "N5": { "title", "blurb", "canDo" } }` for every level in `data/jlpt/levels.json`, built or not |
| `locales/<l>/<level>/kanji.json` | character | `{ "日": ["Day", "Sun"] }` |
| `locales/<l>/<level>/lessons/<file>.json` | lesson slug, then `word\|reading` | `{ "<slug>": { "title", "summary", "words": { "一人\|ひとり": ["One Person", "Alone"] } } }` |
| `locales/<l>/<level>/mnemonics.json` | character | `{ "primitives": { "亻": { "meaning", "note"? } }, "kanji": { "休": { "mnemonic", "roles"? } } }` |

Keep entries in curriculum order, one per line, as the existing files do. That keeps a pull request's
diff to the lines that actually changed.

### What makes a good contribution

These rules apply in every language. Each language may add its own; see its `README.md`, such as
[`locales/id/README.md`](data/jlpt/locales/id/README.md).

- **A kanji's meanings are only what the kanji means by itself.** See
  [How meanings are written](#how-meanings-are-written).
- **Meanings are Title Case**, following each language's rule in `scripts/title-case.mjs`. The
  validator tells you the exact spelling it expects.
- **Glosses are short.** They are quiz answers, not definitions. Two or three meanings at most.
- **Within a lesson, words start with different meanings.** A quiz shows a word's first meaning
  beside other words' first meanings, so two identical ones make a question unanswerable.
- **Memory stories name every part, in brackets:** *A person (亻) leaning on a tree (木): rest.* The
  validator checks this. Keep a story to one or two sentences, and make it land on the meaning.
- **"Once a picture of" means real etymology.** Write it only when it is the character's actual
  origin. Every other story is a memory aid, and should read as one.
- **Write it yourself.** Don't paste from textbooks, paid apps or copyrighted dictionaries. Checking
  your work against a dictionary is encouraged; copying one is not.

### Reporting a mistake

Open an issue with the kanji or word, the lesson it is in, what is wrong, and a source, such as a
dictionary entry. That is enough for someone else to make the fix.

### Fixing a meaning, a lesson title or a summary

1. Find the entry in `data/jlpt/locales/<locale>/<level>/`. Kanji meanings are in `kanji.json`;
   word meanings, lesson titles and summaries are in `lessons/`, in the file named like the
   lesson's own.
2. Edit it and run `npm run validate:content`.

Changing text never affects anyone's progress.

### Fixing a reading or other Japanese

Kanji readings and stroke counts are in `data/jlpt/<level>/kanji.json`. A word's reading is in
`data/jlpt/<level>/lessons/*.json`.

**A word's written form and reading are its identity.** Progress is stored against an id made from
the level, the lesson slug, the word and its reading (see [Word ids](#word-ids)). Correcting a
reading therefore makes it a new word, and learners start that one word over. That's the right
outcome for a wrong reading, but it is why a word should never be renamed casually.

When you change a word or its reading, rename its key (`"word|reading"`) in **every** language's
lesson file to match. The validator lists any file you missed.

### Adding or changing a word

A word needs one line in the curriculum and one in each language:

```jsonc
// data/jlpt/n5/lessons/02-people-and-nature.json, in its lesson's "words"
{ "word": "人気", "reading": "にんき", "pos": "noun", "teaches": "人" },

// data/jlpt/locales/en/n5/lessons/02-people-and-nature.json, in the same lesson's "words"
"人気|にんき": ["Popularity"],

// data/jlpt/locales/id/n5/lessons/02-people-and-nature.json
"人気|にんき": ["Popularitas"],
```

- **`teaches`** is the kanji of this lesson the word is there to demonstrate. The word must contain
  it.
- **`pos`** is one of the parts of speech listed at the top of `scripts/validate-content.mjs`.
- **Each word is taught once in the whole curriculum.** The validator rejects a duplicate, including
  one in another level.
- **A word uses only kanji taught by that point**, apart from a few standard words always written
  with a later one (部屋, 田舎).
- **Every kanji keeps at least four words.**

**If you don't speak one of the app's languages,** add your word in English and say so in the pull
request. The check will fail until someone adds the missing translation, and translators watch for
these.

Removing a word, or moving it to another lesson, resets learners' progress on it, as with a
reading. Say why in the pull request.

### Improving a memory story

Stories are in `data/jlpt/locales/<locale>/<level>/mnemonics.json`, under `kanji`. Rewrite one
freely, as long as it still names every part the kanji lists in `data/jlpt/<level>/parts.json`, in
brackets. A part the kanji lists under `roles` plays a special part in that character; its name for
that part is in the story's `roles`.

A story is written per language, not translated. A better English story doesn't need the others
changed; just say in the pull request that the others might want a look.

Primitives (pieces that aren't kanji of the curriculum) get their meaning, and optionally a note on
how they look inside other characters, under `primitives` in the same file.

### Changing a radical or a kanji's parts

This is structure, so it's the same in every language: `data/jlpt/<level>/parts.json`.

- **`radical`** is the dictionary (Kangxi) radical, in the form it takes inside the character.
- **`parts`** are the pieces a learner can see. Each must be a kanji of any level or a primitive.
  - A new primitive goes under `primitives`, in the first level that uses it, with its Japanese
    name if it has one.
  - Every language then needs a meaning for it in its `mnemonics.json`.
- **`roles`** lists the parts that stand for something other than their usual meaning in this kanji.

Changing parts usually means the stories need updating in every language, because each must name
every part. The validator lists exactly which ones.

### Improving a translation

Content is in `data/jlpt/locales/<locale>/`, and interface text is in `lib/i18n/messages/`, one file
per area of the app. Each messages file holds every language side by side:

```ts
const en = { title: "How you study.", reviews: (n: number) => `${n} reviews` };
const id: typeof en = { title: "Cara kamu belajar.", reviews: (n: number) => `${n} ulasan` };
```

Edit the string for your language. `npx tsc --noEmit` confirms nothing is missing. Follow the
language's style guide and glossary in `data/jlpt/locales/<locale>/README.md`, so the whole app reads
in one voice.

### Translating into a new language

A new language can be built up over many pull requests. Until it ships, the validator only reports
how far it has got, so an unfinished translation never fails the build.

1. **Start the content.** Create `data/jlpt/locales/<locale>/` (a two-letter code: `fr`, `es`,
   `vi`) and copy the shape of `locales/en/`.
   - Start with `levels.json`, then each level's `kanji.json` and `lessons/`.
   - Memory stories come last: they need the most care.
   - `npm run validate:content` prints the percentage done, and
     `npm run validate:content -- --locale fr` lists exactly what is left.
2. **Write a style guide** in `data/jlpt/locales/<locale>/README.md`, with a glossary of the app's
   terms, like the [Indonesian one](data/jlpt/locales/id/README.md). Add your language's joining
   words to `MINOR` in `scripts/title-case.mjs`, so the Title Case check knows them.
3. **Translate the interface.** In every file in `lib/i18n/messages/`, add your language beside the
   others (`const fr: typeof en = { … }`) and export it (`export const settings = { en, id, fr }`).
   Typing it as `typeof en` makes the type checker list every string still missing.
4. **Ship it.** Once the content is at 100% and the interface is complete, make it selectable:
   - Add the language to `LOCALES` and `LOCALE_NAMES` in `lib/i18n/config.ts`, `INTL_TAG` in
     `lib/i18n/format.ts`, and `messages` in `lib/i18n/messages/index.ts`. The language picker in
     Settings and the guest switch in the header list it from there.
   - Add it to `SHIPPED` in `scripts/validate-content.mjs`. From then on it's held to the same
     standard as English and Indonesian.
   - Add a migration that widens `profiles_locale_check` (see
     `supabase/migrations/0007_locale.sql`).

### Adding a level

N3, N2 and N1 are on the roadmap and not yet written. A level is a large piece of work, so open an
issue first to agree on its kanji list and lesson plan.

1. **The curriculum.** Create `data/jlpt/n3/` with `kanji.json`, `parts.json` and
   `lessons/*.json`, in the same shape as `n4/`.
   - Number the lesson files so they sort in study order, and pick slugs no other level uses.
   - Leave out any word an earlier level already teaches.
2. **The text.** Create `data/jlpt/locales/<locale>/n3/` for **every** shipped language (English
   and Indonesian today), mirroring the curriculum.
3. **Wire it up.**
   - Add `"N3"` to `LEVELS` in `lib/content.ts`, and `"n3"` to `LEVELS` in
     `scripts/validate-content.mjs`.
   - Add a loader for its stroke data to `lib/strokeBank.ts`.
4. **Check it.** Run `npm run fetch:strokes -- n3`, then `npm run validate:content`.

No database change is needed: `level` is already a column on every table. A level can be built over
several pull requests on a shared branch. It goes live when it's added to `LEVELS`, and that's also
when it must pass every check.

### Changing code

Read the sections above on how mastery, scheduling and the daily quiz work before changing them.
Then:

- **Put all interface text in `lib/i18n/messages/`**, never inline, and write it in every language.
  If you can only write English, say so in the pull request.
- **Content is read through `lib/content.ts`.** Pass the learner's locale
  (`await getLocale()` from `lib/i18n/server`) to anything whose text reaches the screen.
- **Schema changes are new files** in `supabase/migrations/`, and only ever add to the schema.
  Existing migrations are never edited.

### Before you open a pull request

```bash
npm run validate:content   # content: must end with "Content OK"
npx tsc --noEmit           # code and interface strings: must print nothing
npm run build              # for code changes
```

Then check your change in the app, in each language it touches.
