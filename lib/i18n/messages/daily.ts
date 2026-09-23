/** Strings for the daily namespace. See ./index.ts for the conventions. */

const en = {
  eyebrow: "Daily quiz",
  eyebrowDate: (date: string) => `Daily quiz · ${date}`,
  lockedHeading: (n: number) => `Learn ${n} words to unlock the daily quiz.`,
  lockedBody: (size: number, learned: number) =>
    `Each day asks ${size} questions about words you have already learned. You have ${learned} so far. A word joins the quiz the day after you first study it, so today’s lesson counts from tomorrow.`,
  browseLessons: "Browse Lessons",
  pastWeek: "Past week",
  dayScore: (day: string, correct: number, answered: number) => `${day}: ${correct} of ${answered} correct`,
  dayNotTaken: (day: string) => `${day}: not taken`,
  allCorrect: "Every one. ",
  noneCorrect: "None today — worth a review. ",
  tomorrow: "Five more tomorrow, drawn from every word you have learned by then.",
  youChose: (chosen: string) => `You chose “${chosen}”`,
  correct: "Correct",
  missed: "Missed",
};

const id: typeof en = {
  eyebrow: "Kuis harian",
  eyebrowDate: (date) => `Kuis harian · ${date}`,
  lockedHeading: (n) => `Pelajari ${n} kata untuk membuka kuis harian.`,
  lockedBody: (size, learned) =>
    `Setiap hari ada ${size} pertanyaan tentang kata yang sudah kamu pelajari. Sejauh ini kamu sudah mempelajari ${learned}. Sebuah kata masuk ke kuis sehari setelah pertama kali kamu pelajari, jadi pelajaran hari ini baru dihitung mulai besok.`,
  browseLessons: "Lihat Pelajaran",
  pastWeek: "Seminggu terakhir",
  dayScore: (day, correct, answered) => `${day}: ${correct} dari ${answered} benar`,
  dayNotTaken: (day) => `${day}: tidak dikerjakan`,
  allCorrect: "Benar semua. ",
  noneCorrect: "Tidak ada yang benar hari ini — saatnya mengulas. ",
  tomorrow: "Lima lagi besok, diambil dari semua kata yang sudah kamu pelajari sampai saat itu.",
  youChose: (chosen) => `Kamu memilih “${chosen}”`,
  correct: "Benar",
  missed: "Salah",
};

export const daily = { en, id };
