/** Strings for the dashboard namespace. See ./index.ts for the conventions. */

/** "N5", "N5 and N4", "N3, N2 and N1". */
function list(names: string[], and: string) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}` : names[0];
}

const en = {
  // Daily quiz card
  dailyQuiz: "Daily quiz",
  quizLocked: (size: number, learned: number) =>
    `Unlocks once you have learned ${size} kanji — you have ${learned}. A character joins the day after you first study it.`,
  quizDone: (correct: number, answered: number) => `Today’s quiz: ${correct} of ${answered} correct`,
  quizTomorrow: "Five new questions tomorrow.",
  quizProgress: (answered: number, total: number) => `Daily quiz: ${answered} of ${total} answered`,
  quizFinish: "Finish today’s questions.",
  quizIntro: (size: number) => `${size} questions on kanji you have already learned. One try each.`,
  seeResults: "See Results",
  continueQuiz: "Continue Quiz",
  takeQuiz: "Take Today’s Quiz",

  // Continue card
  nextReviews: "Next: reviews",
  nextLesson: (order: number) => `Next: lesson ${order}`,
  allCaughtUp: "All caught up",
  reviewsReady: (n: number) => `${n} ${n === 1 ? "review is" : "reviews are"} ready.`,
  allDone: "Every lesson is done.",
  clearFirst: (resumeTitle: string | null) =>
    `Clear these first, then ${resumeTitle ? `carry on with the lesson “${resumeTitle}”` : "you are done for now"}. Reviews are what turn a word you have met into one you know.`,
  nothingDue: "Nothing is due right now. Come back later for reviews, or practise any kanji you like.",
  continueReview: "Continue: Review",
  continueLesson: "Continue Lesson",
  startLesson: "Start Lesson",
  continueWith: (label: string) => `Continue: ${label}`,
  practise: "Practise",
  levelKanjiKnown: (level: string) => `${level} kanji known`,
  kanjiOf: (known: number, total: number) => `${known} of ${total} kanji`,

  // Lesson path
  next: "Next",
  due: (n: number) => `${n} due`,
  wordsOf: (known: number, total: number) => `${known}/${total} words`,

  // Hero
  greeting: (name: string) => `Good to see you, ${name}.`,
  streak: (n: number) => `${n} day streak`,
  writingTitle: "What are you learning for?",
  writingBody:
    "Reading is enough for travel and for most everyday Japanese. Choose writing too if you want to draw each kanji from memory. You can change this at any time in Settings.",

  // The path
  yourPath: "Your path",
  pathTitle: (lessons: number, kanji: number) => `${lessons} lessons, ${kanji} kanji`,
  pathBody:
    "The line under each kanji shows how well you know it. Take them in order, or open any lesson: nothing is locked.",
  levelKnown: (known: number, total: number) => `${known}/${total} kanji known`,

  // Numbers
  wordsKnown: "Words known",
  of: (n: number) => `of ${n}`,
  canWrite: "Can write",
  fromMemory: "from memory",
  kanjiStarted: "Kanji started",
  answeredToday: "Answered today",
  goal: (n: number) => `goal ${n}`,
  dayStreak: "Day streak",
  consecutiveDays: "consecutive days",
  accuracy: "Accuracy",
  answersAllTime: (n: number) => `${n} answers, all time`,
  dueNow: "Due now",
  waitingForReview: "waiting for review",

  // Activity and mastery
  last14Days: "Last 14 days",
  cardsAnswered: "Cards answered",
  masteryEyebrow: "Where your kanji sit",
  masteryTitle: "Kanji mastery",
  masteryBody:
    "A kanji counts as known once most of its words are known — each has survived a week-long gap, or you marked it as one you already knew.",

  // Trouble words
  troubleEyebrow: "Needs another look",
  troubleTitle: "The words tripping you up",
  misses: (n: number) => `${n} ${n === 1 ? "miss" : "misses"}`,

  // The road ahead
  beyond: (level: string) => `Beyond ${level}`,
  roadTitle: "The road ahead",
  roadBody: (built: string[], unbuilt: string[]) =>
    `${list(built, "and")} ${built.length === 1 ? "is" : "are"} built.` +
    (unbuilt.length > 0
      ? ` ${list(unbuilt, "and")} ${unbuilt.length === 1 ? "is" : "are"} mapped but not written yet. Their counts are community estimates, because the JLPT has published no official kanji list since 2010.`
      : ""),
  kanjiCount: (n: number) => `${n} kanji`,
  kanjiTarget: (n: number) => `~${n} kanji`,
  availableNow: "Available now",
  notWrittenYet: "Not written yet",
};

const id: typeof en = {
  dailyQuiz: "Kuis harian",
  quizLocked: (size, learned) =>
    `Terbuka setelah kamu mempelajari ${size} kanji — sejauh ini ${learned}. Sebuah kanji masuk kuis sehari setelah pertama kali kamu pelajari.`,
  quizDone: (correct, answered) => `Kuis hari ini: ${correct} dari ${answered} benar`,
  quizTomorrow: "Lima pertanyaan baru besok.",
  quizProgress: (answered, total) => `Kuis harian: ${answered} dari ${total} terjawab`,
  quizFinish: "Selesaikan pertanyaan hari ini.",
  quizIntro: (size) => `${size} pertanyaan tentang kanji yang sudah kamu pelajari. Masing-masing hanya sekali coba.`,
  seeResults: "Lihat Hasil",
  continueQuiz: "Lanjutkan Kuis",
  takeQuiz: "Ikuti Kuis Hari Ini",

  nextReviews: "Berikutnya: ulasan",
  nextLesson: (order) => `Berikutnya: pelajaran ${order}`,
  allCaughtUp: "Semua beres",
  reviewsReady: (n) => `${n} ulasan siap.`,
  allDone: "Semua pelajaran sudah selesai.",
  clearFirst: (resumeTitle) =>
    `Selesaikan ini dulu, lalu ${resumeTitle ? `lanjutkan Pelajaran ${resumeTitle}` : "kamu selesai untuk saat ini"}. Ulasanlah yang mengubah kata yang pernah kamu temui menjadi kata yang kamu tahu.`,
  nothingDue:
    "Belum ada yang perlu diulas sekarang. Kembali lagi nanti untuk ulasan, atau latih kanji apa pun yang kamu mau.",
  continueReview: "Lanjut: Ulasan",
  continueLesson: "Lanjutkan Pelajaran",
  startLesson: "Mulai Pelajaran",
  continueWith: (label) => `Lanjut: ${label}`,
  practise: "Latihan",
  levelKanjiKnown: (level) => `Kanji ${level} yang sudah kamu tahu`,
  kanjiOf: (known, total) => `${known} dari ${total} kanji`,

  next: "Berikutnya",
  due: (n) => `${n} perlu diulas`,
  wordsOf: (known, total) => `${known}/${total} kata`,

  greeting: (name) => `Senang bertemu lagi, ${name}.`,
  streak: (n) => `${n} hari beruntun`,
  writingTitle: "Kamu belajar untuk apa?",
  writingBody:
    "Membaca sudah cukup untuk bepergian dan sebagian besar bahasa Jepang sehari-hari. Pilih juga menulis jika kamu ingin menggambar setiap kanji dari ingatan. Kamu bisa mengubahnya kapan saja di Pengaturan.",

  yourPath: "Jalur belajarmu",
  pathTitle: (lessons, kanji) => `${lessons} pelajaran, ${kanji} kanji`,
  pathBody:
    "Garis di bawah setiap kanji menunjukkan seberapa baik kamu mengenalnya. Ikuti secara berurutan, atau buka pelajaran mana saja: tidak ada yang dikunci.",
  levelKnown: (known, total) => `${known}/${total} kanji sudah tahu`,

  wordsKnown: "Kata sudah tahu",
  of: (n) => `dari ${n}`,
  canWrite: "Bisa ditulis",
  fromMemory: "dari ingatan",
  kanjiStarted: "Kanji dimulai",
  answeredToday: "Dijawab hari ini",
  goal: (n) => `target ${n}`,
  dayStreak: "Hari beruntun",
  consecutiveDays: "hari berturut-turut",
  accuracy: "Akurasi",
  answersAllTime: (n) => `${n} jawaban, sepanjang waktu`,
  dueNow: "Perlu diulas",
  waitingForReview: "menunggu diulas",

  last14Days: "14 hari terakhir",
  cardsAnswered: "Kartu dijawab",
  masteryEyebrow: "Posisi kanji-mu",
  masteryTitle: "Penguasaan kanji",
  masteryBody:
    "Sebuah kanji dihitung sudah tahu setelah sebagian besar katanya sudah kamu tahu — masing-masing sudah bertahan melewati jeda seminggu, atau kamu tandai sebagai kata yang sudah kamu tahu.",

  troubleEyebrow: "Perlu dilihat lagi",
  troubleTitle: "Kata-kata yang sering membuatmu keliru",
  misses: (n) => `${n} kali salah`,

  beyond: (level) => `Setelah ${level}`,
  roadTitle: "Perjalanan selanjutnya",
  roadBody: (built, unbuilt) =>
    `${list(built, "dan")} sudah tersedia.` +
    (unbuilt.length > 0
      ? ` ${list(unbuilt, "dan")} sudah dipetakan, tetapi belum ditulis. Jumlah kanjinya adalah perkiraan komunitas, karena JLPT tidak lagi menerbitkan daftar kanji resmi sejak 2010.`
      : ""),
  kanjiCount: (n) => `${n} kanji`,
  kanjiTarget: (n) => `~${n} kanji`,
  availableNow: "Tersedia sekarang",
  notWrittenYet: "Belum ditulis",
};

export const dashboard = { en, id };
