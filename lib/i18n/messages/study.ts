/** Strings for the study namespace. See ./index.ts for the conventions. */
import type { CardKind } from "@/lib/study";

type QuizKind = Exclude<CardKind, "kanji-teach" | "kanji-write" | "word-teach">;

const en = {
  /** The question above each kind of multiple-choice card. */
  prompt: {
    "kanji-meaning": "What does this character mean?",
    "word-meaning": "What does this word mean?",
    "word-reading": "How is this read?",
    "word-recall": "Which word is this?",
  } satisfies Record<QuizKind, string>,

  save: {
    sessionExpired: "Your session expired. Sign in again.",
    database: "Could not reach the database.",
    network: "Could not reach the server.",
    /** Bold lead of the warning, followed by the detail and `after`. */
    notSaved: "Progress is not being saved.",
    after: "You can keep going, but this session will not be recorded.",
  },

  nothingLeftLesson: "Everything in this lesson is marked as known, so there is nothing left to study here.",
  nothingLeft: "Nothing to study here right now.",
  resumedAt: (n: number) => ` · resumed at kanji ${n}`,

  hints: {
    turnOff: "Turn off writing hints",
    turnOn: "Turn on writing hints",
    offTitle: "Turn off hints (H)",
    onTitle: "Hint each stroke as you write it (H)",
    naOn: "No writing on this card. Hints stay on for the next one.",
    naOff: "No writing on this card. Hints stay off for the next one.",
  },
  furigana: {
    hide: "Hide the reading",
    show: "Show the reading",
    hideTitle: "Hide the reading (F)",
    showTitle: "Show the reading (F)",
    naShown: "No reading on this card. Readings stay on for the next word.",
    naHidden: "No reading on this card. Readings stay hidden for the next word.",
  },

  reviewFirst: {
    eyebrow: (title: string) => `Before you start ${title}`,
    heading: (n: number) => `You have ${n} ${n === 1 ? "review" : "reviews"} waiting.`,
    body: "Reviewing first helps the new lesson stick: new kanji build on the ones you have already met. Nothing is locked, so you can start the lesson anyway.",
    reviewFirst: "Review First",
    startAnyway: "Start Anyway",
    /** Around a link to the settings page. */
    settingsBefore: "You can change when this appears, or turn it off, in",
    settingsLink: "Settings",
    settingsAfter: ".",
  },

  gotIt: "Got It",
  alreadyKnow: "Already Know It",
  newKanji: "New kanji",
  on: "On",
  kun: "Kun",
  strokes: (n: number) => `${n} strokes`,
  knownKanjiTitle: (char: string) => `Mark the words for ${char} as known and skip them`,
  inAWord: (char: string) => `${char} in a word`,
  knownWordTitle: (word: string) => `Mark ${word} as known and skip its questions`,

  correct: "Correct",
  notQuite: "Not quite",
  finish: "Finish",
  next: "Next",

  summary: {
    complete: "Session complete",
    accuracy: "Accuracy",
    answered: "Answered",
    practiceGuest: "This was practice, so none of it was saved.",
    practice:
      "This was practice, so none of it was saved. Your progress and your review schedule are exactly as they were.",
    practiseAgain: "Practise Again",
    changePractice: "Change Practice",
    guest:
      "None of this was saved, because you are not signed in. With an account, every answer is scheduled: what you missed comes back within minutes, and what you knew moves further out.",
    signIn: "Sign In to Save Progress",
    browseLessons: "Browse Lessons",
    saved:
      "Everything you answered is scheduled. What you missed comes back within minutes; what you knew moves further out.",
    dashboard: "Back to Dashboard",
    startReview: "Start a Review",
  },

  /** The review page. */
  review: {
    title: "Review",
    nothingDue: "Nothing due",
    empty: "Your review queue is empty.",
    emptyWriting:
      "Words, and the kanji you have written, come back on a schedule that stretches as you get them right. Start a lesson to put new ones into the queue.",
    emptyReading:
      "Words come back on a schedule that stretches as you get them right. Start a lesson to put new kanji and their vocabulary into the queue.",
    browseLessons: "Browse Lessons",
  },
};

const id: typeof en = {
  prompt: {
    "kanji-meaning": "Apa arti kanji ini?",
    "word-meaning": "Apa arti kata ini?",
    "word-reading": "Bagaimana cara bacanya?",
    "word-recall": "Kata yang mana ini?",
  },

  save: {
    sessionExpired: "Sesimu sudah berakhir. Silakan masuk lagi.",
    database: "Tidak dapat terhubung ke database.",
    network: "Tidak dapat terhubung ke server.",
    notSaved: "Progres tidak tersimpan.",
    after: "Kamu bisa lanjut, tetapi sesi ini tidak akan dicatat.",
  },

  nothingLeftLesson:
    "Semua isi pelajaran ini sudah ditandai sudah tahu, jadi tidak ada lagi yang perlu dipelajari di sini.",
  nothingLeft: "Belum ada yang perlu dipelajari saat ini.",
  resumedAt: (n: number) => ` · dilanjutkan dari kanji ke-${n}`,

  hints: {
    turnOff: "Matikan petunjuk menulis",
    turnOn: "Nyalakan petunjuk menulis",
    offTitle: "Matikan petunjuk (H)",
    onTitle: "Beri petunjuk tiap goresan saat kamu menulis (H)",
    naOn: "Tidak ada latihan menulis di kartu ini. Petunjuk tetap menyala untuk kartu berikutnya.",
    naOff: "Tidak ada latihan menulis di kartu ini. Petunjuk tetap mati untuk kartu berikutnya.",
  },
  furigana: {
    hide: "Sembunyikan cara baca",
    show: "Tampilkan cara baca",
    hideTitle: "Sembunyikan cara baca (F)",
    showTitle: "Tampilkan cara baca (F)",
    naShown: "Tidak ada cara baca di kartu ini. Cara baca tetap tampil untuk kata berikutnya.",
    naHidden: "Tidak ada cara baca di kartu ini. Cara baca tetap tersembunyi untuk kata berikutnya.",
  },

  reviewFirst: {
    eyebrow: (title: string) => `Sebelum memulai ${title}`,
    heading: (n: number) => `Ada ${n} ulasan yang menunggumu.`,
    body: "Mengulas lebih dulu membuat pelajaran baru lebih melekat: kanji baru dibangun di atas kanji yang sudah kamu temui. Tidak ada yang dikunci, jadi kamu tetap bisa memulai pelajarannya.",
    reviewFirst: "Ulas Dulu",
    startAnyway: "Tetap Mulai",
    settingsBefore: "Kamu bisa mengubah kapan pesan ini muncul, atau mematikannya, di",
    settingsLink: "Pengaturan",
    settingsAfter: ".",
  },

  gotIt: "Mengerti",
  alreadyKnow: "Sudah Tahu",
  newKanji: "Kanji baru",
  on: "On",
  kun: "Kun",
  strokes: (n: number) => `${n} goresan`,
  knownKanjiTitle: (char: string) => `Tandai kata-kata untuk ${char} sebagai sudah tahu dan lewati`,
  inAWord: (char: string) => `${char} dalam kata`,
  knownWordTitle: (word: string) => `Tandai ${word} sebagai sudah tahu dan lewati pertanyaannya`,

  correct: "Benar",
  notQuite: "Belum tepat",
  finish: "Selesai",
  next: "Lanjut",

  summary: {
    complete: "Sesi selesai",
    accuracy: "Akurasi",
    answered: "Dijawab",
    practiceGuest: "Ini latihan, jadi tidak ada yang disimpan.",
    practice:
      "Ini latihan, jadi tidak ada yang disimpan. Progres dan jadwal ulasanmu tetap seperti sebelumnya.",
    practiseAgain: "Latihan Lagi",
    changePractice: "Ubah Latihan",
    guest:
      "Tidak ada yang disimpan karena kamu belum masuk. Dengan akun, setiap jawaban dijadwalkan: yang salah muncul lagi dalam beberapa menit, dan yang sudah kamu tahu muncul lebih jarang.",
    signIn: "Masuk untuk Menyimpan Progres",
    browseLessons: "Lihat Pelajaran",
    saved:
      "Semua jawabanmu sudah dijadwalkan. Yang salah muncul lagi dalam beberapa menit; yang sudah kamu tahu muncul lebih jarang.",
    dashboard: "Kembali ke Dasbor",
    startReview: "Mulai Ulasan",
  },

  review: {
    title: "Ulasan",
    nothingDue: "Belum ada ulasan",
    empty: "Antrean ulasanmu kosong.",
    emptyWriting:
      "Kata, dan kanji yang sudah kamu tulis, muncul lagi dengan jadwal yang makin renggang setiap kali kamu menjawab benar. Mulai pelajaran untuk menambah yang baru ke antrean.",
    emptyReading:
      "Kata muncul lagi dengan jadwal yang makin renggang setiap kali kamu menjawab benar. Mulai pelajaran untuk menambah kanji baru beserta kosakatanya ke antrean.",
    browseLessons: "Lihat Pelajaran",
  },
};

export const study = { en, id };
