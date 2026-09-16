/** Strings for the home namespace. See ./index.ts for the conventions. */

/** "N5", "N5 and N4", "N3, N2 and N1". */
function list(names: string[], and: string) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}` : names[0];
}

type LevelCount = { level: string; kanji: number };

const en = {
  signIn: "Sign In",
  eyebrow: (levels: string[]) => `A free study aid for the JLPT ${levels.join(" and ")} kanji`,
  title: "For anyone who finds kanji hard to remember.",
  intro:
    "If you have ever learned a kanji on Monday and lost it by Wednesday, you are not alone. Kanjikan goes slowly: about five kanji a lesson. It shows how each one is built, gives you a short story to hang it on, teaches the everyday words that use it, and brings it back for review before you forget.",
  noAccount:
    "You do not need an account to take the lessons. Sign in only if you want your progress remembered.",
  startLesson1: "Start with Lesson 1",
  seeAllLessons: "See All Lessons",

  howTitle: "How it tries to help",
  how: [
    [
      "A few at a time.",
      "Each lesson has about five kanji, and each one is finished — seen, used in words, quizzed and, if you like, written — before the next one starts.",
    ],
    [
      "Built from parts.",
      "Most kanji are made of smaller pieces. Every new kanji shows its parts, what they mean, and a short story that ties them together, so it becomes something you can picture instead of a jumble of strokes.",
    ],
    [
      "Words, not just characters.",
      "Each kanji comes with a handful of real words that use it. Readings are much easier to keep when they belong to words you know.",
    ],
    [
      "Writing by hand, if you want it.",
      "Reading is enough for travel and most everyday Japanese, so writing is your choice. Choose it and you watch the stroke order, then draw the kanji yourself from memory. Each stroke is checked against the model for its order, direction, length and shape.",
    ],
    [
      "Reviews before you forget.",
      "If you sign in, what you get wrong comes back within minutes and what you know moves further out. A five-question daily quiz checks what has stuck.",
    ],
    [
      "Skip what you already know.",
      "Learned some kanji somewhere else? Mark a word, a kanji or a whole lesson as known and the lessons skip it. It comes back once, about a week later, to check.",
    ],
  ] as [string, string][],

  exampleTitle: "What a new kanji looks like",
  exampleIntro: (char: string, lesson: number) => `This is how a lesson introduces ${char}, from lesson ${lesson}.`,

  hereTitle: "What is here, and what is not",
  hereContent: (built: LevelCount[], lessons: number, words: number) =>
    `${built.map((l, i) => `${i === 0 ? "All" : "all"} ${l.kanji} ${l.level} kanji`).join(" and ")}, in ${lessons} lessons, with ${words} words that use them.`,
  hereUnbuilt: (levels: string[]) =>
    `${levels.length === 1 ? `${levels[0]} is` : `${levels[0]} to ${levels[levels.length - 1]} are`} not written yet.`,
  hereFree: "It is free. There are no ads, nothing to buy, and no premium version.",
  hereAccount:
    "An account is only a username and a password — no email address. That also means there is no password reset, so keep yours somewhere safe.",

  accuracyTitle: "A note on accuracy",
  accuracy1:
    "Kanjikan was built with the help of AI — the app itself, and much of the learning content too: the word lists, readings, meanings and memory stories.",
  accuracy2:
    "I made it, and I check what I can, but I am still learning Japanese myself. There is only so much I can catch, and some of it is bound to be wrong. Please treat it as a study aid rather than an authority, and check anything important against a dictionary — especially before an exam.",
  accuracy3:
    "If you find a mistake, or would like to help correct or add lessons, please open an issue on GitHub. Every correction makes it better for the next person who is struggling with the same kanji.",
  openIssue: "Open an Issue on GitHub",

  /** Footer: "Stroke order from <KanjiVG>, CC BY-SA 3.0 · <Source on GitHub>". */
  strokesFrom: "Stroke order from",
  strokesLicence: ", CC BY-SA 3.0 ·",
  source: "Source on GitHub",
};

const id: typeof en = {
  signIn: "Masuk",
  eyebrow: (levels) => `Alat bantu belajar gratis untuk kanji JLPT ${levels.join(" dan ")}`,
  title: "Untuk kamu yang merasa kanji sulit diingat.",
  intro:
    "Kalau kamu pernah mempelajari sebuah kanji hari Senin lalu lupa di hari Rabu, kamu tidak sendirian. Kanjikan berjalan pelan: sekitar lima kanji per pelajaran. Setiap kanji ditunjukkan cara penyusunannya, diberi cerita pendek sebagai pegangan, diajarkan bersama kata sehari-hari yang memakainya, lalu dimunculkan lagi untuk diulas sebelum kamu lupa.",
  noAccount:
    "Kamu tidak perlu akun untuk mengikuti pelajaran. Masuk hanya jika kamu ingin progresmu tersimpan.",
  startLesson1: "Mulai dari Pelajaran 1",
  seeAllLessons: "Lihat Semua Pelajaran",

  howTitle: "Cara Kanjikan membantumu",
  how: [
    [
      "Sedikit demi sedikit.",
      "Setiap pelajaran berisi sekitar lima kanji, dan setiap kanji dituntaskan — dilihat, dipakai dalam kata, dikuiskan, dan jika kamu mau, ditulis — sebelum kanji berikutnya dimulai.",
    ],
    [
      "Tersusun dari bagian.",
      "Sebagian besar kanji terbentuk dari potongan-potongan kecil. Setiap kanji baru menunjukkan bagian-bagiannya, artinya, dan cerita pendek yang merangkainya, sehingga kanji itu menjadi sesuatu yang bisa kamu bayangkan, bukan sekadar tumpukan goresan.",
    ],
    [
      "Kata, bukan hanya huruf.",
      "Setiap kanji dilengkapi beberapa kata nyata yang memakainya. Cara baca jauh lebih mudah diingat jika melekat pada kata yang kamu tahu.",
    ],
    [
      "Menulis tangan, jika kamu mau.",
      "Membaca sudah cukup untuk bepergian dan sebagian besar bahasa Jepang sehari-hari, jadi menulis adalah pilihanmu. Jika kamu memilihnya, kamu akan melihat urutan goresan, lalu menggambar kanji itu sendiri dari ingatan. Setiap goresan diperiksa terhadap contohnya: urutan, arah, panjang, dan bentuknya.",
    ],
    [
      "Ulasan sebelum kamu lupa.",
      "Jika kamu masuk, yang kamu jawab salah akan muncul lagi dalam hitungan menit, dan yang sudah kamu tahu akan muncul makin jarang. Kuis harian berisi lima pertanyaan memeriksa apa yang sudah melekat.",
    ],
    [
      "Lewati yang sudah kamu tahu.",
      "Sudah belajar beberapa kanji di tempat lain? Tandai sebuah kata, kanji, atau seluruh pelajaran sebagai sudah tahu, dan pelajaran akan melewatinya. Kanji itu muncul sekali lagi, sekitar seminggu kemudian, untuk memeriksa.",
    ],
  ],

  exampleTitle: "Seperti apa kanji baru ditampilkan",
  exampleIntro: (char, lesson) => `Beginilah sebuah pelajaran memperkenalkan ${char}, dari pelajaran ${lesson}.`,

  hereTitle: "Apa yang ada, dan apa yang belum",
  hereContent: (built, lessons, words) =>
    `${list(
      built.map((l, i) => `${i === 0 ? "Semua" : "semua"} ${l.kanji} kanji ${l.level}`),
      "dan",
    )}, dalam ${lessons} pelajaran, dengan ${words} kata yang memakainya.`,
  hereUnbuilt: (levels) =>
    `${levels.length === 1 ? levels[0] : `${levels[0]} sampai ${levels[levels.length - 1]}`} belum ditulis.`,
  hereFree: "Gratis. Tanpa iklan, tanpa pembelian, dan tanpa versi premium.",
  hereAccount:
    "Akun hanya berupa nama pengguna dan kata sandi — tanpa alamat email. Artinya, kata sandi juga tidak bisa diatur ulang, jadi simpan kata sandimu di tempat yang aman.",

  accuracyTitle: "Catatan tentang ketepatan",
  accuracy1:
    "Kanjikan dibuat dengan bantuan AI — aplikasinya sendiri, dan juga sebagian besar materi belajarnya: daftar kata, cara baca, arti, dan cerita pengingat.",
  accuracy2:
    "Saya yang membuatnya, dan saya memeriksa sebisa saya, tetapi saya sendiri masih belajar bahasa Jepang. Tidak semua kesalahan bisa saya temukan, dan pasti ada yang keliru. Anggaplah ini alat bantu belajar, bukan rujukan utama, dan periksa hal penting di kamus — terutama sebelum ujian.",
  accuracy3:
    "Jika kamu menemukan kesalahan, atau ingin membantu memperbaiki atau menambah pelajaran, silakan buka issue di GitHub. Setiap koreksi membuatnya lebih baik bagi orang berikutnya yang kesulitan dengan kanji yang sama.",
  openIssue: "Buka Issue di GitHub",

  strokesFrom: "Urutan goresan dari",
  strokesLicence: ", CC BY-SA 3.0 ·",
  source: "Kode sumber di GitHub",
};

export const home = { en, id };
