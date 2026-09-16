/** The settings page. See ./index.ts for the conventions. */

const en = {
  eyebrow: "Settings",
  title: "How you study.",
  signedInAs: "Signed in as",
  savesAsYouGo: "Changes save as you make them.",
  notSaved: "Not saved.",
  saved: "Saved.",
  language: {
    heading: "Language",
    body: "The language of the app, the meanings and the memory stories. The Japanese stays the same, and so does your progress.",
    label: "Language",
  },
  writing: {
    heading: "Writing",
    body: "Reading and writing are tracked separately, so you can learn to read without ever drawing a stroke. Switching keeps any writing progress you already have.",
    label: "What you are learning",
    readingOnly: "Reading only",
    readingOnlyDetail: "Recognise kanji and read the words. No drawing.",
    readingAndWriting: "Reading and writing",
    readingAndWritingDetail: "Also write each kanji from memory, reviewed on its own schedule.",
  },
  warning: {
    heading: "Before a new lesson",
    body: "When this many reviews are waiting, starting a lesson first suggests clearing them. It never stops you: you can always start anyway.",
    label: "Warn before a new lesson at",
    reviews: (n: number) => `${n} reviews`,
    never: "Never",
  },
};

const id: typeof en = {
  eyebrow: "Pengaturan",
  title: "Cara kamu belajar.",
  signedInAs: "Masuk sebagai",
  savesAsYouGo: "Perubahan langsung tersimpan.",
  notSaved: "Tidak tersimpan.",
  saved: "Tersimpan.",
  language: {
    heading: "Bahasa",
    body: "Bahasa untuk aplikasi, arti kata, dan cerita pengingat. Bahasa Jepangnya tetap sama, begitu juga progres belajarmu.",
    label: "Bahasa",
  },
  writing: {
    heading: "Menulis",
    body: "Membaca dan menulis dicatat terpisah, jadi kamu bisa belajar membaca tanpa pernah menggoreskan satu garis pun. Progres menulis yang sudah ada tetap tersimpan saat kamu beralih.",
    label: "Yang sedang kamu pelajari",
    readingOnly: "Membaca saja",
    readingOnlyDetail: "Mengenali kanji dan membaca kata. Tanpa menulis.",
    readingAndWriting: "Membaca dan menulis",
    readingAndWritingDetail: "Juga menulis setiap kanji dari ingatan, dengan jadwal ulasan tersendiri.",
  },
  warning: {
    heading: "Sebelum pelajaran baru",
    body: "Jika ulasan yang menunggu sudah sebanyak ini, kamu akan disarankan menyelesaikannya dulu sebelum memulai pelajaran. Ini tidak pernah menghalangimu: kamu tetap bisa langsung mulai.",
    label: "Ingatkan sebelum pelajaran baru saat ada",
    reviews: (n: number) => `${n} ulasan`,
    never: "Tidak pernah",
  },
};

export const settings = { en, id };
