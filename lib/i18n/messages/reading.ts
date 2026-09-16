/** Strings for the reading namespace. See ./index.ts for the conventions. */

const en = {
  eyebrow: "Reading",
  heading: "Read a whole story.",
  intro:
    "Longer passages written with the kanji of one level, and questions to check you followed them. Kanji from a later level carry their reading. Nothing here is saved.",
  levelHeading: (level: string) => `Test your ${level} comprehension`,
  levelIntro: (level: string) =>
    `Written with ${level} kanji and the levels before it. Anything beyond ${level} has furigana.`,
  storyBadge: (level: string, order: string) => `${level} · Story ${order}`,
  length: (chars: number) => `${chars} characters`,
  levelKanji: (n: number, level: string) => `${n} ${level} kanji`,
  storyCount: (n: number) => (n === 1 ? "1 story." : `${n} stories.`),
  allStories: "← All stories",
  kanjiHeading: (level: string) => `${level} kanji in this story`,
  showAll: "Show all readings",
  tapHint: "Tap a word to see its reading.",
  questionsHeading: "Questions",
  questionsCount: (n: number) => (n === 1 ? "1 question" : `${n} questions`),
  questionsNote: "Choose the best answer. Nothing is saved.",
  question: (n: number) => `Question ${n}`,
  correct: "Correct.",
  incorrect: "Not quite. The answer is marked.",
  startOver: "Start Over",
  showTranslation: "Show Translation",
  hideTranslation: "Hide Translation",
  translationHeading: "Translation",
};

const id: typeof en = {
  eyebrow: "Bacaan",
  heading: "Baca satu cerita utuh.",
  intro:
    "Bacaan yang lebih panjang, ditulis dengan kanji satu level, beserta pertanyaan untuk mengecek pemahamanmu. Kanji dari level berikutnya diberi cara bacanya. Tidak ada yang disimpan di sini.",
  levelHeading: (level) => `Uji pemahaman ${level}-mu`,
  levelIntro: (level) =>
    `Ditulis dengan kanji ${level} dan level sebelumnya. Kanji di atas ${level} diberi furigana.`,
  storyBadge: (level, order) => `${level} · Cerita ${order}`,
  length: (chars) => `${chars} karakter`,
  levelKanji: (n, level) => `${n} kanji ${level}`,
  storyCount: (n) => `${n} cerita.`,
  allStories: "← Semua cerita",
  kanjiHeading: (level) => `Kanji ${level} dalam cerita ini`,
  showAll: "Tampilkan semua cara baca",
  tapHint: "Klik sebuah kata untuk melihat cara bacanya.",
  questionsHeading: "Pertanyaan",
  questionsCount: (n) => `${n} pertanyaan`,
  questionsNote: "Pilih jawaban yang paling tepat. Tidak ada yang disimpan.",
  question: (n) => `Pertanyaan ${n}`,
  correct: "Benar.",
  incorrect: "Kurang tepat. Jawaban yang benar sudah ditandai.",
  startOver: "Ulangi",
  showTranslation: "Tampilkan Terjemahan",
  hideTranslation: "Sembunyikan Terjemahan",
  translationHeading: "Terjemahan",
};

export const reading = { en, id };
