/** Strings for the practice namespace. See ./index.ts for the conventions. */

const en = {
  eyebrow: "Practice",
  heading: "Drill the kanji you choose.",
  intro: "Pick a whole level or single characters, choose what to practise, and start.",
  /** The title a practice run shows where a lesson shows its own. */
  sessionTitle: "Practice",
  types: {
    reading: {
      label: "Reading",
      body: "What each kanji means, and how the words it teaches are read.",
    },
    writing: {
      label: "Writing",
      body: "Write each kanji from memory. Every stroke is checked.",
    },
    hearing: {
      label: "Hearing",
      body: "Pick the word you hear.",
    },
  },
  pickKanji: "Pick at least one kanji.",
  pickType: "Choose what to practise.",
  summary: (kanji: number, types: string[]) => `${kanji} kanji · ${types.join(" and ")}`,
  chooseKanji: "Choose kanji",
  wholeLevel: "A whole level",
  levelTitle: (title: string, kanji: number) => `${title}: ${kanji} kanji`,
  levelLater: (level: string) => `${level} is coming later`,
  comingLater: "Coming later",
  pickedOf: (picked: number, total: number) => `${picked} of ${total}`,
  kanjiCount: (n: number) => `${n} kanji`,
  singles: (level: string) => `Or single kanji from ${level}`,
  chooseType: "Choose what to practise",
  chooseTypeNote: "Pick one or more.",
  clear: "Clear",
  start: "Start Practice",
};

const id: typeof en = {
  eyebrow: "Latihan",
  heading: "Latih kanji pilihanmu.",
  intro: "Pilih satu level penuh atau karakter satu per satu, pilih yang ingin dilatih, lalu mulai.",
  sessionTitle: "Latihan",
  types: {
    reading: {
      label: "Membaca",
      body: "Arti setiap kanji, dan cara baca kata-kata yang diajarkannya.",
    },
    writing: {
      label: "Menulis",
      body: "Tulis setiap kanji dari ingatan. Setiap goresan diperiksa.",
    },
    hearing: {
      label: "Mendengar",
      body: "Pilih kata yang kamu dengar.",
    },
  },
  pickKanji: "Pilih setidaknya satu kanji.",
  pickType: "Pilih yang ingin dilatih.",
  summary: (kanji, types) => `${kanji} kanji · ${types.join(" dan ")}`,
  chooseKanji: "Pilih kanji",
  wholeLevel: "Satu level penuh",
  levelTitle: (title, kanji) => `${title}: ${kanji} kanji`,
  levelLater: (level) => `${level} segera hadir`,
  comingLater: "Segera hadir",
  pickedOf: (picked, total) => `${picked} dari ${total}`,
  kanjiCount: (n) => `${n} kanji`,
  singles: (level) => `Atau kanji satu per satu dari ${level}`,
  chooseType: "Pilih yang ingin dilatih",
  chooseTypeNote: "Pilih satu atau lebih.",
  clear: "Hapus",
  start: "Mulai Latihan",
};

export const practice = { en, id };
