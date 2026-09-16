# Contributing to Kanjikan

Kanjikan is built and maintained by its community. Anyone can improve any meaning, word, memory
story, reading story or translation. Most improvements are an edit to a single JSON file, with no
code involved.

This guide covers each kind of content in turn: where it lives, what the rules are, and what a change
does to learners' progress. The [README](README.md) explains how the app itself works.

- [Ways to help](#ways-to-help)
- [Getting set up](#getting-set-up)
- [How the content is organised](#how-the-content-is-organised)
- [Rules for every contribution](#rules-for-every-contribution)
- [Reporting a mistake](#reporting-a-mistake)
- Content, one kind at a time
  - [Kanji: meanings](#kanji-meanings)
  - [Kanji: readings and stroke counts](#kanji-readings-and-stroke-counts)
  - [Kanji: radicals and parts](#kanji-radicals-and-parts)
  - [Memory stories](#memory-stories)
  - [Words](#words)
  - [Lesson titles and summaries](#lesson-titles-and-summaries)
  - [Level descriptions](#level-descriptions)
  - [Reading stories](#reading-stories)
  - [Interface text](#interface-text)
- [Languages](#languages)
  - [Translating into a new language](#translating-into-a-new-language)
  - [Interface text in interface.json](#interface-text-in-interfacejson)
- [Adding a level](#adding-a-level)
- [Changing code](#changing-code)
- [Before you open a pull request](#before-you-open-a-pull-request)

---

## Ways to help

| You want to… | Where | Guide |
|---|---|---|
| Report a mistake without editing anything | A GitHub issue | [Reporting a mistake](#reporting-a-mistake) |
| Fix what a kanji means | `data/jlpt/locales/<locale>/<level>/kanji.json` | [Kanji meanings](#kanji-meanings) |
| Fix a kanji's reading or stroke count | `data/jlpt/<level>/kanji.json` | [Readings](#kanji-readings-and-stroke-counts) |
| Correct a radical or a kanji's parts | `data/jlpt/<level>/parts.json` | [Parts](#kanji-radicals-and-parts) |
| Write a better memory story | `data/jlpt/locales/<locale>/<level>/mnemonics.json` | [Memory stories](#memory-stories) |
| Add, fix, move or remove a word | `data/jlpt/<level>/lessons/*.json`, plus every language | [Words](#words) |
| Fix a lesson's title or summary | `data/jlpt/locales/<locale>/<level>/lessons/*.json` | [Lessons](#lesson-titles-and-summaries) |
| Fix how a level is described | `data/jlpt/locales/<locale>/levels.json` | [Levels](#level-descriptions) |
| Write a reading story, or fix one | `data/jlpt/<level>/stories.json`, plus every language | [Reading stories](#reading-stories) |
| Fix a button, label or message | `lib/i18n/messages/`, or a language's `interface.json` | [Interface text](#interface-text) |
| Improve an existing translation | `data/jlpt/locales/<locale>/`, `lib/i18n/messages/` | [Improving a translation](#improving-a-translation) |
| Translate the app into a new language | A new `data/jlpt/locales/<locale>/` folder: nothing else | [New language](#translating-into-a-new-language) |
| Build N3, N2 or N1 | A new `data/jlpt/<level>/` | [New level](#adding-a-level) |
| Fix a bug or build a feature | `app/`, `components/`, `lib/` | [Code](#changing-code) |

## Getting set up

```bash
git clone <your fork>
cd kanjikan
npm install
npm run validate:content    # the check every content change must pass
npm run dev                 # http://localhost:3000
```

**You don't need a database to check a content change.** Without one, the home page, Lessons,
Practice and Reading all work as they do for a guest, in every language. Use the language switch in
the header to change language. Signing in, reviews and the dashboard need the database described under
[Setup](README.md#setup).

Work on a branch and open a pull request. In the description, say what you changed and why. For any
change to readings or meanings, link a dictionary entry or another source.

## How the content is organised

The content is split in two, and most changes touch only one side:

- **`data/jlpt/<level>/` is the curriculum.** It holds what is true in every language: which kanji a
  level has, their readings and stroke counts, their parts, which lesson teaches each one, the words
  that teach them, and the Japanese of the reading stories. There is no English in it.
- **`data/jlpt/locales/<locale>/` is what a learner reads, one folder per language.** It holds
  meanings, lesson titles and summaries, memory stories, level descriptions, and story titles and
  translations. Each language's folder mirrors the curriculum file for file.
- **English (`locales/en/`) is the reference.** Anything a language hasn't translated yet is shown
  in English, so a language can be offered long before it is finished.
- **A language is its folder.** Any folder under `locales/` named with a language code (`fr`,
  `pt-BR`) appears in the app's language pickers. A language marked `"complete": true` in its
  `locale.json`, as English and Indonesian are, must have an entry for everything English has.

```
data/jlpt/
  levels.json                 Estimated kanji counts for N5 to N1
  n5/, n4/                    The curriculum
    kanji.json                  Characters, readings, stroke counts
    parts.json                  Radicals, parts and primitives
    lessons/*.json              Lessons and the words that teach each kanji
    stories.json                Reading stories, in Japanese, with their questions
    strokes.json                Stroke order, fetched from KanjiVG (don't edit by hand)
  locales/<locale>/           What a learner reads, per language
    locale.json                 The language's own name, and whether it is complete
    interface.json              Interface text, for a language not written in lib/i18n/messages
    README.md                   That language's style guide
    levels.json                 Each level's title and description
    n5/, n4/
      kanji.json                  Kanji meanings
      mnemonics.json              Memory stories, part roles, primitive meanings
      lessons/*.json              Lesson titles and summaries, word meanings
      stories.json                Story titles, summaries and translations
```

Every text file is keyed by something in the curriculum:

| File | Keyed by | Shape |
|---|---|---|
| `locales/<l>/levels.json` | level | `{ "N5": { "title", "blurb", "canDo" } }` for every level in `data/jlpt/levels.json`, built or not |
| `locales/<l>/<level>/kanji.json` | character | `{ "日": ["Day", "Sun"] }` |
| `locales/<l>/<level>/mnemonics.json` | character | `{ "primitives": { "亻": { "meaning", "note"? } }, "kanji": { "休": { "mnemonic", "roles"? } } }` |
| `locales/<l>/<level>/lessons/<file>.json` | lesson slug, then `word\|reading` | `{ "<slug>": { "title", "summary", "words": { "一人\|ひとり": ["One Person", "Alone"] } } }` |
| `locales/<l>/<level>/stories.json` | story slug | `{ "<slug>": { "title", "summary", "translation": ["one entry per paragraph"] } }` |

Keep entries in curriculum order, one per line, as the existing files do. That keeps a pull request's
diff to the lines that actually changed.

**What a change does to progress.** Learners' progress is stored against each word, using an id made
from the level, the lesson, the word and its reading ([Word ids](README.md#word-ids)). Anything
that changes those four starts learners over on that word. Nothing else does: text, meanings, memory
stories, parts and reading stories can all change freely.

## Rules for every contribution

These apply in every language. Each language may add its own in its style guide, such as
[`locales/id/README.md`](data/jlpt/locales/id/README.md).

- **Write it yourself.** Don't paste from textbooks, paid apps, copyrighted dictionaries or published
  stories. Checking your work against a dictionary is encouraged; copying one is not.
- **Cite a source for Japanese.** A reading, a meaning or a radical is a fact, and a reviewer needs
  to be able to check it.
- **Run the validator.** `npm run validate:content` catches almost every structural mistake, and its
  messages say what it expected.
- **One kind of change per pull request** where you can. A fix to three meanings is easy to review;
  a fix to three meanings mixed with a new story is not.

## Reporting a mistake

Open an issue with the kanji, word or story, where it appears, what is wrong, and a source, such as
a dictionary entry. That is enough for someone else to make the fix.

---

## Kanji: meanings

**Where:** `data/jlpt/locales/<locale>/<level>/kanji.json`, one line per character.

```json
"火": ["Fire"],
```

- **A kanji's meanings are only what the kanji means by itself.** 火 is *Fire*, not *Tuesday*
  (火曜日) or *Fireworks* (花火); those belong to the words. A sense the kanji carries everywhere
  stays, including as a counter, prefix or suffix: 分 *Minute*, 円 *Yen*. See
  [How meanings are written](README.md#how-meanings-are-written).
- **Title Case**, following each language's rule in `scripts/title-case.mjs`. The validator tells
  you the exact spelling it expects.
- **Short.** Meanings are quiz answers, not definitions: two or three at most, the most useful first.
- **The first meaning matters most.** It is the one quizzes show, and a part's label uses the first
  two.

Changing a meaning never affects progress.

## Kanji: readings and stroke counts

**Where:** `data/jlpt/<level>/kanji.json`.

```json
{ "char": "日", "strokes": 4, "onyomi": ["ニチ", "ジツ"], "kunyomi": ["ひ", "か"] },
```

- **On'yomi in katakana, kun'yomi in hiragana.** Mark a reading used only as a prefix with a
  trailing hyphen, as in `"ひと-"`.
- **List the readings a learner at this level meets.** Rare or name-only readings don't belong here.
- **Stroke counts** must match the stroke-order data. `strokes.json` is fetched from KanjiVG
  (`npm run fetch:strokes`), so don't edit it by hand. If KanjiVG itself is wrong, open an issue.

A kanji's readings aren't part of any id, so fixing one doesn't affect progress. A word's reading
is different; see [Words](#words).

## Kanji: radicals and parts

**Where:** `data/jlpt/<level>/parts.json`. This is structure, so it's the same in every language.

```json
"休": { "radical": "亻", "parts": ["亻", "木"] },
"食": { "radical": "食", "parts": ["人", "良"], "roles": ["人"] },
```

- **`radical`** is the dictionary (Kangxi) radical, in the form it takes inside the character. It
  overrides KanjiVG, which sometimes records a stroke instead (丿 for 年). See
  [Radicals, parts and mnemonics](README.md#radicals-parts-and-mnemonics).
- **`parts`** are the pieces a learner can see. Each must be a kanji of any level or a primitive.
  - A new primitive goes under `primitives`, in the **first** level that uses it, with its Japanese
    name if it has one. A later level never redefines it.
  - Every language then needs a meaning for it in its `mnemonics.json`.
- **`roles`** lists the parts that stand for something other than their usual meaning in this kanji:
  人 is a person, but in 食 it is the lid. Every language names that role.

Changing parts usually means the memory stories need updating in every language, because each must
name every part. The validator lists exactly which ones.

## Memory stories

**Where:** `data/jlpt/locales/<locale>/<level>/mnemonics.json`, under `kanji`.

```json
"休": { "mnemonic": "A person (亻) leaning against a tree (木): rest." },
"食": { "mnemonic": "A lid (人) over a pot of something good (良): eat, food.", "roles": { "人": "Lid" } },
```

- **Name every part, in brackets,** exactly as `parts.json` lists them. The validator checks this.
- **One or two sentences,** landing on the meaning.
- **"Once a picture of" means real etymology.** Write it only when it is the character's actual
  origin. Every other story is a memory aid, and should read as one.
- **Written per language, not translated.** A better English story doesn't mean the others have to
  change. Say in the pull request that they might want a look. A language's style guide explains how
  to adapt wordplay that doesn't carry over.
- **Primitives** get a `meaning`, and optionally a `note` on how they look inside other characters,
  under `primitives` in the same file.

Memory stories never affect progress.

## Words

**Where:** one line in the curriculum, and one in each language.

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
- **A word uses only kanji taught by that point**, apart from a few standard words that are always
  written with a later one (部屋, 田舎).
- **Every kanji keeps at least four words**, so its readings are fixed from more than one angle.
- **Within a lesson, words start with different meanings.** A quiz shows a word's first meaning
  beside other words' first meanings, and two identical ones make a question impossible to answer.

**Progress.** A word's written form, its reading and its lesson are its identity.
- **Fixing a meaning** is safe.
- **Fixing the word or its reading** makes it a new word, and learners start that one word over.
  That's the right outcome for a wrong reading, but it's why a word should never be renamed casually.
  When you do, rename its `"word|reading"` key in **every** language's lesson file; the validator
  lists any you missed.
- **Removing a word, or moving it to another lesson,** also resets it. Say why in the pull request.

**If you don't speak one of the app's languages,** add the word in English and say so in the pull
request. The check will fail until someone adds the missing translation, and translators watch for
these.

## Lesson titles and summaries

**Where:** `data/jlpt/locales/<locale>/<level>/lessons/<file>.json`, under the lesson's slug, in the
file named like the lesson's own.

```json
"one-to-five": {
  "title": "One to five",
  "summary": "The first five numerals. …",
  "words": { … }
}
```

- **Titles are in sentence case** and short.
- **A summary says what the lesson is about** and, where it helps, what makes its kanji tricky.

A lesson's slug and its kanji are curriculum, in `data/jlpt/<level>/lessons/`. Changing a slug
changes every word id in the lesson, so it is almost never the right fix.

## Level descriptions

**Where:** `data/jlpt/locales/<locale>/levels.json`.

```json
"N5": { "title": "Foundations", "blurb": "…", "canDo": "…" }
```

Every level on the roadmap in `data/jlpt/levels.json` needs an entry, including levels that aren't
built yet. The kanji counts in `data/jlpt/levels.json` are community estimates. A built level's real
counts come from its own files, so don't copy them into the text.

## Reading stories

The Reading page (`/reading`) has a set of stories for each level, each with comprehension
questions. Like Practice, it is open to guests, and nothing a reader does there is saved or counts
towards mastery. So you can add, rewrite or remove a story without affecting anyone's progress.

### Where a story lives

The Japanese and the questions are curriculum, in `data/jlpt/<level>/stories.json`:

```json
{
  "slug": "my-day",
  "title": "わたしの{一日|いちにち}",
  "body": [
    "わたしは{川上|かわかみ|name}{友子|ともこ|name}です。{大学|だいがく}の{二年生|にねんせい}で、…",
    "…"
  ],
  "questions": [
    {
      "prompt": "{友子|ともこ|name}さんは{毎朝|まいあさ}{何時|なんじ}に{家|いえ}を{出|で}ますか。",
      "choices": ["{六時半|ろくじはん}", "{七時|しちじ}", "{七時|しちじ}{四十分|よんじゅっぷん}", "{九時|くじ}"],
      "answer": 2
    }
  ]
}
```

Each language adds the title, a summary and a translation, in
`data/jlpt/locales/<locale>/<level>/stories.json`:

```json
"my-day": {
  "title": "My day",
  "summary": "A university student walks through an ordinary Monday. Times, days of the week and daily verbs.",
  "translation": ["I am Tomoko Kawakami. …", "…"]
}
```

Stories are listed in file order and numbered from it, so add a new one at the end.

### Readings and furigana

**Every word written in kanji carries its reading**, as `{漢字|かんじ}`, wherever it appears: in the
title, the body, the questions and the choices. The page uses these to decide what to show:

| Markup | Shown |
|---|---|
| `{学校|がっこう}` in an N5 story | No furigana. All its kanji are N5, so this is what the story tests. The reader can tap it to see the reading. |
| `{東京|とうきょう}` in an N5 story | Furigana, because 京 is an N4 kanji. The same markup in an N4 story shows none. |
| `{傘|かさ}` | Always furigana: 傘 isn't in any built level. |
| `{田中|たなか|name}` | Always furigana: see below. |

- **Only kanji go inside the braces.** Keep okurigana and other kana outside: `{食|た}べます`,
  `{一|いっ}か{月|げつ}`. The reading is kana only.
- **Mark the whole word**, not each character: `{図書館|としょかん}`. A word with even one kanji
  beyond the level gets furigana across the whole word, as graded readers do.
- **々 goes inside the word it repeats**: `{少々|しょうしょう}`.
- **Mark people's names** with `|name`, as in `{中村|なかむら|name}`. No lesson teaches how names are
  read, so a name always shows furigana, even when its kanji belong to the story's level. Its kanji
  also don't count towards the ones the story tests. Use it for other proper names that a lesson
  doesn't teach, too: a shop called `{山川|やまかわ|name}`, a mountain called `{白山|しろやま|name}`.
  A place name that a lesson teaches as a word, like 東京 or 日本, doesn't need it.

The validator rejects any kanji without a reading, a reading that isn't kana, and a stray `{`, `}`
or `|`.

### Writing for the level

- **Use the level's kanji generously.** That is what the story tests. The validator warns when a
  story uses fewer than ten, and its output shows how many each story uses and how many the level's
  stories cover together. A new story that brings in kanji the others don't use is especially
  welcome.
- **Keep the grammar and vocabulary within reach** of a learner at that level. N5 stories use plain
  です/ます sentences. N4 can use the te-form, potential and passive, and simple honorifics.
- **Write kanji from later levels only where a real text would.** They get furigana either way. For
  a word usually written in kana, write it in kana.
- **Aim for five or six paragraphs:** roughly 300–400 characters at N5 and 400–550 at N4.
- **Everyday situations work best**, as in the JLPT: a day, a trip, a shop, a letter, a small problem
  and how it was solved. Give it a small turn or ending, so there is something to understand beyond
  the vocabulary.
- **Stories must be your own writing.** Don't copy, translate or closely adapt published stories,
  textbook or exam passages, or song lyrics. A folk tale retold in your own words is fine.

### Questions

- **Five per story**, each with **four choices**.
- **In Japanese**, as in the JLPT, and within the story's level. Mark readings in them exactly as in
  the body.
- **`answer` is the index of the right choice, counting from 0.** Vary its position across a story's
  questions.
- **Test understanding, not matching.** At least one question should need an inference or a
  paraphrase: a total price worked out from two prices, a reason given in other words, "which of
  these is *not* true".
- **Each choice should be plausible.** Wrong answers should come from the story (another time,
  another person) rather than be obviously absurd.
- **Only one answer can be right.** The validator checks the choices are all different; a reviewer
  checks the rest.

### Translations

- **One entry per paragraph**, in the same order. The validator checks the count.
- **Translate the meaning,** in natural prose for that language, following its style guide. Names
  are written in the Latin alphabet, family name last in English (*Tomoko Kawakami*).
- **The title is a translation of the story's title in sentence case**, and the **summary** is one
  or two sentences: what happens, then what the story practises (*Times, days of the week and daily
  verbs.*).
- **Questions and choices aren't translated.** Reading them is part of the test.
- **Don't guess a character's gender** that the Japanese leaves open. Use a name (*Nakamura-san*)
  or rephrase.

### Changing an existing story

- **Fixing Japanese** is one edit in `data/jlpt/<level>/stories.json`. If it changes the meaning,
  update the translation in every language.
- **Adding or removing a paragraph** means doing the same in every language's `translation`. The
  validator lists each one that is out of step.
- **Renaming a slug** changes the story's address, so rename its key in every language too. Avoid
  it unless the slug is wrong.
- **Removing a story** means removing its entry in every language as well.

### Checklist for a new story

1. Add the story to the end of `data/jlpt/<level>/stories.json`, with a slug no other story uses.
2. Add its `title`, `summary` and `translation` to `data/jlpt/locales/<locale>/<level>/stories.json`
   for English and every language marked complete (Indonesian today). If you can only write English,
   say so in the pull request. Other languages show the English until they translate it.
3. Run `npm run validate:content`, and check the story's line in its output.
4. Run `npm run dev` and open `/reading`. Read the story with furigana off and on, answer every
   question, and check the translation in each language.

## Interface text

The buttons, labels and messages are written in one of two places.

- **English and Indonesian** are TypeScript, in `lib/i18n/messages/`.
- **Every other language** writes them in `data/jlpt/locales/<locale>/interface.json`; see
  [Interface text in interface.json](#interface-text-in-interfacejson).

In `lib/i18n/messages/` there is one file per area of the app, and each holds both languages side by
side:

```ts
const en = { title: "How you study.", reviews: (n: number) => `${n} reviews` };
const id: typeof en = { title: "Cara kamu belajar.", reviews: (n: number) => `${n} ulasan` };
```

- **Buttons and actions are in Title Case** ("Start Over"). Headings and sentences are in sentence
  case.
- **A string that takes a value is a function.** Plurals are decided inside it.
- **Change every language** you can. `npx tsc --noEmit` fails if a language is missing a string.
- **A new English string** appears in English in every folder language until it is translated. Its
  key shows up in `npm run validate:content -- --locale <code>`.

---

## Languages

A language is a folder: `data/jlpt/locales/<code>/`. The app lists every folder there named with a
language code, and shows English for whatever the folder doesn't have yet. Adding a language needs no
code change, no configuration and no database change.

### Improving a translation

Content is in `data/jlpt/locales/<locale>/`. Interface text is in `lib/i18n/messages/` for English and
Indonesian, and in the folder's `interface.json` for every other language. Follow the language's style
guide and glossary in `data/jlpt/locales/<locale>/README.md`, so the whole app reads in one voice.
`npm run validate:content` and `npx tsc --noEmit` confirm nothing is missing.

### Translating into a new language

A language can be built up over many pull requests. It is in the app from the first one, with
English wherever it has no text of its own. The validator only reports how far it has got, so an
unfinished translation never fails the build.

1. **Create the folder.**

   ```bash
   npm run locale:new -- fr "Français"
   ```

   This writes `data/jlpt/locales/fr/` with:
   - `locale.json`: `{ "name": "Français", "complete": false }`. `name` is what the language
     pickers show, written in the language itself.
   - `interface.json`: `{}`, for the interface text.
   - `interface.reference.json`: every English interface string, as a template to translate from.
     It is rebuilt each time you run the command, and isn't committed.

   Use a lower-case language code, with a region or script after a hyphen if you need one: `fr`,
   `es`, `vi`, `pt-BR`, `zh-Hant`. A folder named any other way is ignored.

   Run `npm run dev`: the language is already in the header switch and in Settings.
2. **Translate the interface.** Copy entries from `interface.reference.json` into `interface.json`,
   keeping the same keys, and translate them. You can go one area at a time. See
   [Interface text in interface.json](#interface-text-in-interfacejson).
3. **Translate the content.** Add files shaped like `locales/en/`, and translate them.
   - Start with `levels.json`, then each level's `kanji.json` and `lessons/`.
   - Then each level's `stories.json`: titles, summaries and translations.
   - Memory stories come last: they need the most care.
   - A file, or an entry in one, can be added whenever it's ready. Anything missing stays English.
4. **Check your progress.** `npm run validate:content` prints how much of the content and of the
   interface is done, and `npm run validate:content -- --locale fr` lists exactly what is left.
5. **Write a style guide** in `data/jlpt/locales/<locale>/README.md`, with a glossary of the app's
   terms, like the [Indonesian one](data/jlpt/locales/id/README.md). Add your language's joining
   words to `MINOR` in `scripts/title-case.mjs`, so the Title Case check knows them.
6. **Mark it complete** once everything is translated: set `"complete": true` in `locale.json`.
   From then on the validator holds it to the same standard as English and Indonesian, so a missing
   string fails the build instead of quietly showing English.

**Removing a language** is deleting its folder. A learner who had chosen it sees English.

### Interface text in interface.json

`interface.json` has the same keys as English's messages, nested the same way. Leave out anything
you haven't translated.

```json
{
  "shell": {
    "nav": { "lessons": "Leçons", "reading": "Lecture" },
    "switchLanguage": "Passer en {0}"
  },
  "reading": {
    "levelHeading": "Testez votre compréhension {0}",
    "storyCount": { "one": "{0} histoire.", "other": "{0} histoires." }
  },
  "kanji": {
    "writing": {
      "suggested": { "true": "Cela semble juste.", "false": "Pas encore tout à fait." }
    }
  }
}
```

| Write | For | Example |
|---|---|---|
| Plain text | A string that takes no values | `"Leçons"` |
| `{0}`, `{1}`… | The values a string takes, in English's order. A list of values is joined the language's own way ("N5 et N4"). | `"Passer en {0}"` |
| `{ "one": …, "other": … }` | A string with a count. Use the plural forms your language has: `zero`, `one`, `two`, `few`, `many`, `other`. `"=0"`, `"=1"`… match an exact number. `other` is required. | `{ "one": "{0} histoire", "other": "{0} histoires" }` |
| `{ "true": …, "false": … }` | A string that depends on a yes or no | `{ "true": "Cela semble juste.", "false": "Pas encore." }` |
| `"$arg": 2` | Inside either of the two above: which value the form follows, when it isn't the first count or the first yes/no | `{ "$arg": 1, "one": …, "other": … }` |
| `<strong>…</strong>`, `<jp>…</jp>` | Emphasis and Japanese text, only where English uses them. The reference shows where. | `"Une partie est la <strong>clé</strong>"` |

- **Keep every `{0}` the English has.** The reference shows each one in place. You can move them
  anywhere in the sentence.
- **A list in English, such as a set of steps, is a list here too.** Give it as an array, or as an
  object of just the items you've translated: `{ "1": ["Titre", "Texte"] }`.
- **A few strings can't be written this way,** because their wording depends on more than a count or
  a yes/no. They stay in English: `dashboard.roadBody`, `home.hereContent`, `home.hereUnbuilt` and
  `kanji.writing.note`. They're listed in `TEMPLATE_EXCLUDED` in `lib/i18n/messages/index.ts`.
  Translating those too means adding the language to `lib/i18n/messages/` in TypeScript, as
  Indonesian is. That's a code change, so open an issue first.
- **Mistakes never break a page.** A key the app doesn't have, a `{3}` in a string with two values,
  or a tag a string doesn't support is reported by the validator, and that string is shown in
  English.

## Adding a level

N3, N2 and N1 are on the roadmap and not yet written. A level is a large piece of work, so open an
issue first to agree on its kanji list and lesson plan.

1. **The curriculum.** Create `data/jlpt/n3/` with `kanji.json`, `parts.json` and
   `lessons/*.json`, in the same shape as `n4/`.
   - Number the lesson files so they sort in study order, and pick slugs no other level uses.
   - Leave out any word an earlier level already teaches.
   - Reading stories (`stories.json`) are optional, and can come in later pull requests.
2. **The text.** Create `data/jlpt/locales/<locale>/n3/` for English and for every language marked
   complete (Indonesian today), mirroring the curriculum. Other languages show English for it until
   they catch up.
3. **Wire it up.**
   - Add `"N3"` to `LEVELS` in `lib/content.ts`, and `"n3"` to `LEVELS` in
     `scripts/validate-content.mjs`.
   - Add a loader for its stroke data to `lib/strokeBank.ts`.
4. **Check it.** Run `npm run fetch:strokes -- n3`, then `npm run validate:content`.

No database change is needed: `level` is already a column on every table. A level can be built over
several pull requests on a shared branch. It goes live when it's added to `LEVELS`, and that's also
when it must pass every check.

## Changing code

Read the README's sections on how [mastery](README.md#how-mastery-works),
[scheduling](README.md#how-the-scheduling-works) and the
[daily quiz](README.md#daily-quiz) work before changing them. Then:

- **Put all interface text in `lib/i18n/messages/`**, never inline, and write it in every language.
  If you can only write English, say so in the pull request.
- **Content is read through `lib/content.ts`.** Pass the learner's locale
  (`await getLocale()` from `lib/i18n/server`) to anything whose text reaches the screen.
- **Pages under `app/(open)/` work without an account** and never save anything. Anything that
  needs saved progress belongs under `app/(app)/`.
- **Schema changes are new files** in `supabase/migrations/`, and only ever add to the schema.
  Existing migrations are never edited.

## Before you open a pull request

```bash
npm run validate:content   # content: must end with "Content OK"
npx tsc --noEmit           # code and interface strings: must print nothing
npm run build              # for code changes
```

Then check your change in the app, in each language it touches.
