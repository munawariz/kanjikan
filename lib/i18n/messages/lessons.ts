/** Strings for the lessons namespace. See ./index.ts for the conventions. */

const en = {
  // The lesson list.
  curriculum: (levels: string[]) => `JLPT ${levels.join(" and ")} curriculum`,
  heading: (kanji: number) => `${kanji} kanji, about five at a time.`,
  intro: (first: string, last: string) =>
    `Lessons run in order, from ${first} into ${last}, but nothing is locked. Each introduces a handful of characters and teaches the words that fix their readings. If you are learning to write, it ends with you writing each one from memory.`,
  statKanji: "Kanji",
  statLessons: "Lessons",
  statCompleted: "Completed",
  statInProgress: "In progress",
  levelRange: (level: string, from: number, to: number) => `${level} · Lessons ${from}–${to}`,
  levelHeading: (title: string, kanji: number) => `${title}: ${kanji} kanji`,

  // One lesson.
  allLessons: "← All lessons",
  lessonBadge: (level: string, order: string) => `${level} · Lesson ${order}`,
  completed: "Completed",
  start: "Start Lesson",
  again: "Practise Again",
  continue: "Continue Lesson",
  markIntro:
    "Learned these somewhere else? Mark them as known and the lesson skips them. They come back once, in about a week, to check.",
  markLesson: "I Know This Lesson",
  markLessonDone: "Words marked as known",
  markLessonTitle: "Mark every word in this lesson as known",
  markLessonWriting: "I Can Write These Kanji",
  writingMarked: "Writing marked as known",
  markLessonWritingTitle: (n: number) => `Mark all ${n} kanji as ones you can write`,
  progress: (known: number, total: number, words: number) =>
    `${known} of ${total} kanji known · ${words} words`,
  charactersEyebrow: "The characters",
  charactersHeading: (kanji: number, words: number) => `${kanji} kanji, ${words} words to fix them`,
  canWrite: "Can write",
  wordsKnown: (known: number, total: number) => `${known} of ${total} words known`,
  strokes: (n: number) => `${n} strokes`,
  radical: "radical",
  markKanji: (char: string) => `I Know ${char}`,
  markedKnown: "Marked as known",
  markKanjiTitle: (char: string) => `Mark the words for ${char} as known`,
  markKanjiWriting: (char: string) => `I Can Write ${char}`,
  wordListEyebrow: "Word list",
  wordCount: (n: number) => `${n} words`,
  markWord: "I Know It",
  markedKnownBadge: "Marked known",
};

const id: typeof en = {
  curriculum: (levels) => `Kurikulum JLPT ${levels.join(" dan ")}`,
  heading: (kanji) => `${kanji} kanji, sekitar lima sekaligus.`,
  intro: (first, last) =>
    `Pelajaran berjalan berurutan, dari ${first} sampai ${last}, tetapi tidak ada yang dikunci. Setiap pelajaran memperkenalkan beberapa karakter dan mengajarkan kata-kata yang memantapkan cara bacanya. Kalau kamu belajar menulis, pelajaran diakhiri dengan menulis setiap kanji dari ingatan.`,
  statKanji: "Kanji",
  statLessons: "Pelajaran",
  statCompleted: "Selesai",
  statInProgress: "Sedang berjalan",
  levelRange: (level, from, to) => `${level} · Pelajaran ${from}–${to}`,
  levelHeading: (title, kanji) => `${title}: ${kanji} kanji`,

  allLessons: "← Semua pelajaran",
  lessonBadge: (level, order) => `${level} · Pelajaran ${order}`,
  completed: "Selesai",
  start: "Mulai Pelajaran",
  again: "Latihan Lagi",
  continue: "Lanjutkan Pelajaran",
  markIntro:
    "Sudah mempelajarinya di tempat lain? Tandai sebagai sudah tahu, dan pelajaran akan melewatinya. Kata-kata ini muncul sekali lagi sekitar seminggu kemudian untuk dicek.",
  markLesson: "Saya Tahu Pelajaran Ini",
  markLessonDone: "Kata ditandai sudah tahu",
  markLessonTitle: "Tandai semua kata di pelajaran ini sebagai sudah tahu",
  markLessonWriting: "Saya Bisa Menulis Kanji Ini",
  writingMarked: "Menulis ditandai sudah tahu",
  markLessonWritingTitle: (n) => `Tandai ${n} kanji ini sebagai kanji yang bisa kamu tulis`,
  progress: (known, total, words) => `${known} dari ${total} kanji sudah tahu · ${words} kata`,
  charactersEyebrow: "Karakter",
  charactersHeading: (kanji, words) => `${kanji} kanji, ${words} kata untuk memantapkannya`,
  canWrite: "Bisa menulis",
  wordsKnown: (known, total) => `${known} dari ${total} kata sudah tahu`,
  strokes: (n) => `${n} goresan`,
  radical: "radikal",
  markKanji: (char) => `Saya Tahu ${char}`,
  markedKnown: "Ditandai sudah tahu",
  markKanjiTitle: (char) => `Tandai kata-kata untuk ${char} sebagai sudah tahu`,
  markKanjiWriting: (char) => `Saya Bisa Menulis ${char}`,
  wordListEyebrow: "Daftar kata",
  wordCount: (n) => `${n} kata`,
  markWord: "Saya Tahu",
  markedKnownBadge: "Ditandai sudah tahu",
};

export const lessons = { en, id };
