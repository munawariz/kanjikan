# Bahasa Indonesia: style guide

Everything a learner reads in Indonesian lives in this folder. The files have the same shape as
`locales/en/`, and the main README's **Contributing** section explains each one. This page covers
what is specific to Indonesian.

`npm run validate:content` checks that every built level is fully translated here. Indonesian ships
in the app, so a gap fails the build.

## Rules

- **Meanings are Title Case**, as in English, but Indonesian joining words stay lower case in the
  middle of a phrase: *dan, atau, tetapi, serta, di, ke, dari, pada, untuk, dengan, oleh, per,
  dalam, yang, sebagai, tentang*. See `scripts/title-case.mjs`. Qualifiers in parentheses stay as
  written: `"Ayah (sopan)"`. Hyphenated words capitalise both halves: `"Laki-Laki"`.
- **Translate the meaning, not the English word.** A gloss says what the Japanese word means to an
  Indonesian speaker, so check the kanji and the reading, not just the English. "Cold (weather)"
  becomes `"Dingin (cuaca)"` and "To Go" becomes `"Pergi"`.
  - Use the plain root where that is the natural dictionary form: `"Makan"`, `"Minum"`, `"Pergi"`.
  - Keep the prefix where the bare root reads as something else: `"Membaca"`, `"Menulis"`,
    `"Bekerja"`.
- **Keep the distinctions English keeps.** If English tells two words apart, Indonesian must too,
  even where it has only one word. Add a qualifier:
  - 月 is `"Bulan (di langit)"` for the moon and `"Bulan (kalender)"` for the month.
  - 彼 is `"Dia (laki-laki)"`.
  - 週 is `"Pekan"`, because *Minggu* is also Sunday.
- **Keep the answer choices apart.** Quizzes offer a word's first meaning next to other words'
  first meanings, so two words in the same lesson should not start with the same meaning.
- **Adapt memory stories; don't translate them.** A story must still work as a memory aid in
  Indonesian.
  - English wordplay that doesn't carry over gets a new image: for 万, "ka-ching" became
    *"ka untuk kas"*.
  - Keep every part character in brackets, exactly as the English does: `"Sebuah kurungan (囗) …"`.
    The validator checks this.
  - A story that says "once a picture of" gives the character's real origin, so keep that as
    *"aslinya gambar …"*. Every other story is only a memory aid.
- **Japanese stays Japanese**: kanji, kana, readings, radical names, and terms like *onyomi*,
  *kunyomi*, *hiragana* and *furigana*.
- **Address the learner as *kamu*.** The one exception is set phrases a learner would say to
  someone else, such as お待たせしました, which use *Anda*.

## Glossary

Use these terms here and in `lib/i18n/messages/`, so the app reads as one voice.

| English | Indonesian |
|---|---|
| kanji | kanji |
| word | kata |
| meaning | arti |
| reading | cara baca |
| lesson | pelajaran |
| review (noun / verb) | ulasan / ulas |
| practice | latihan |
| daily quiz | kuis harian |
| writing, to write | menulis |
| stroke, stroke order | goresan, urutan goresan |
| radical | radikal |
| part (of a kanji) | bagian |
| mnemonic, memory story | cerita pengingat |
| known / mastered / learning / not started | sudah tahu / dikuasai / sedang dipelajari / belum dimulai |
| due (for review) | perlu diulas |
| streak | hari beruntun |
| level | level |
| settings | pengaturan |
| sign in / sign out | masuk / keluar |
| account, username, password | akun, nama pengguna, kata sandi |
| home | beranda |
| guest | tamu |
