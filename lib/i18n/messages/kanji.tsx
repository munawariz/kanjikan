/** Strings for the kanji namespace. See ./index.ts for the conventions. */
import type { ReactNode } from "react";
import type { Direction, Note, Offset, Verdict } from "@/lib/handwriting";

/** Wraps a word in emphasis, or a run of Japanese in its face. */
type Markup = { strong: (text: string) => ReactNode; jp: (text: string) => ReactNode };

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

const RUNS_EN: Record<Direction, string> = {
  right: "from left to right",
  left: "from right to left",
  down: "from top to bottom",
  up: "from bottom to top",
  downRight: "down and to the right",
  downLeft: "down and to the left",
  upRight: "up and to the right",
  upLeft: "up and to the left",
};

function whereEn({ h, v }: Offset): string {
  const far = h ? `far ${h}` : null;
  if (far && v) return `${v} and too ${far}`;
  return far ?? v ?? "far from its place";
}

function noteEn(note: Note): string {
  switch (note.code) {
    case "lookalike":
      return `This reads more like ${note.other} than ${note.char}.`;
    case "extra":
      return note.count === 1
        ? `One stroke does not match any stroke of ${note.char}.`
        : `${note.count} strokes do not match any stroke of ${note.char}.`;
    case "missing":
      return `Stroke ${note.n} is missing.`;
    case "reversed":
      return `Stroke ${note.n} goes the wrong way: it runs ${RUNS_EN[note.runs]}.`;
    case "outOfOrder":
      return `Stroke ${note.n} is out of order: you wrote it ${ordinal(note.drawnAt)}.`;
    case "shouldBend":
      return `Stroke ${note.n} should bend or hook, not run straight.`;
    case "shouldBeStraight":
      return `Stroke ${note.n} should be a straight line.`;
    case "wrongAngle":
      return `Stroke ${note.n} is at the wrong angle: it runs ${RUNS_EN[note.runs]}.`;
    case "wrongShape":
      return `Stroke ${note.n} is the wrong shape.`;
    case "shouldBeLonger":
      return `Stroke ${note.n} should be longer than stroke ${note.than}.`;
    case "shouldBeShorter":
      return `Stroke ${note.n} should be shorter than stroke ${note.than}.`;
    case "tooLongNextTo":
      return `Stroke ${note.n} is too long next to stroke ${note.than}.`;
    case "tooShortNextTo":
      return `Stroke ${note.n} is too short next to stroke ${note.than}.`;
    case "misplaced":
      return `Stroke ${note.n} sits too ${whereEn(note.offset)}.`;
    case "tooLong":
      return `Stroke ${note.n} is too long.`;
    case "tooShort":
      return `Stroke ${note.n} is too short.`;
    case "tooManyStrokes":
      return `This kanji has only ${note.total} strokes.`;
    case "looksLikeLater":
      return `That looks like stroke ${note.later}. Stroke ${note.n} comes first.`;
    case "looksRight":
      return `Stroke ${note.n} looks right.`;
  }
}

const RUNS_ID: Record<Direction, string> = {
  right: "dari kiri ke kanan",
  left: "dari kanan ke kiri",
  down: "dari atas ke bawah",
  up: "dari bawah ke atas",
  downRight: "miring ke kanan bawah",
  downLeft: "miring ke kiri bawah",
  upRight: "miring ke kanan atas",
  upLeft: "miring ke kiri atas",
};

function whereId({ h, v }: Offset): string {
  const side = h ? (h === "right" ? "ke kanan" : "ke kiri") : null;
  const height = v ? (v === "low" ? "rendah" : "tinggi") : null;
  if (side && height) return `${height} dan terlalu ${side}`;
  return side ?? height ?? "jauh dari tempatnya";
}

function noteId(note: Note): string {
  switch (note.code) {
    case "lookalike":
      return `Tulisan ini lebih mirip ${note.other} daripada ${note.char}.`;
    case "extra":
      return note.count === 1
        ? `Ada satu goresan yang tidak cocok dengan goresan mana pun pada ${note.char}.`
        : `Ada ${note.count} goresan yang tidak cocok dengan goresan mana pun pada ${note.char}.`;
    case "missing":
      return `Goresan ${note.n} terlewat.`;
    case "reversed":
      return `Arah goresan ${note.n} terbalik: seharusnya ${RUNS_ID[note.runs]}.`;
    case "outOfOrder":
      return `Urutan goresan ${note.n} salah: kamu menulisnya sebagai goresan ke-${note.drawnAt}.`;
    case "shouldBend":
      return `Goresan ${note.n} seharusnya melengkung atau berkait, bukan lurus.`;
    case "shouldBeStraight":
      return `Goresan ${note.n} seharusnya berupa garis lurus.`;
    case "wrongAngle":
      return `Sudut goresan ${note.n} salah: seharusnya ${RUNS_ID[note.runs]}.`;
    case "wrongShape":
      return `Bentuk goresan ${note.n} salah.`;
    case "shouldBeLonger":
      return `Goresan ${note.n} seharusnya lebih panjang daripada goresan ${note.than}.`;
    case "shouldBeShorter":
      return `Goresan ${note.n} seharusnya lebih pendek daripada goresan ${note.than}.`;
    case "tooLongNextTo":
      return `Goresan ${note.n} terlalu panjang dibanding goresan ${note.than}.`;
    case "tooShortNextTo":
      return `Goresan ${note.n} terlalu pendek dibanding goresan ${note.than}.`;
    case "misplaced":
      return `Goresan ${note.n} terlalu ${whereId(note.offset)}.`;
    case "tooLong":
      return `Goresan ${note.n} terlalu panjang.`;
    case "tooShort":
      return `Goresan ${note.n} terlalu pendek.`;
    case "tooManyStrokes":
      return `Kanji ini hanya punya ${note.total} goresan.`;
    case "looksLikeLater":
      return `Itu tampak seperti goresan ${note.later}. Goresan ${note.n} dulu.`;
    case "looksRight":
      return `Goresan ${note.n} sudah tepat.`;
  }
}

const en = {
  on: "On",
  kun: "Kun",
  strokes: (n: number) => `${n} strokes`,

  page: {
    eyebrow: (count: number, levels: string[]) => `All ${count} kanji, ${levels.join(" and ")}`,
    heading: (known: number, total: number) => `${known} of ${total} characters known.`,
    introWriting:
      "In curriculum order. A tinted tile is a character you know — most of its words are known; the dot marks one you can also write from memory. Select any character for its stroke order, readings and vocabulary.",
    intro:
      "In curriculum order. A tinted tile is a character you know — most of its words are known. Select any character for its stroke order, readings and vocabulary.",
  },

  explorer: {
    levelCount: (level: string, n: number) => `${level} · ${n} kanji`,
    canWriteDot: "can write",
    canWrite: "Can write",
    wordsKnown: (known: number, total: number) => `${known} of ${total} of its words known`,
    markReading: (char: string) => `I Know ${char}`,
    markedReading: "Marked as known",
    markReadingTitle: (char: string) => `Mark the words that teach ${char} as known`,
    markWriting: (char: string) => `I Can Write ${char}`,
    markedWriting: "Writing marked as known",
    taughtIn: (level: string, order: string) => `${level} · Taught in lesson ${order}`,
    wordsUseIt: (n: number) => `${n} words use it`,
  },

  anatomy: {
    radicalTag: " · radical",
    howToRemember: "How to remember it",
    builtFrom: "Built from",
    basicShape: "A basic shape",
    notBuilt: "Not built from smaller parts — it is one of the pieces other kanji are made of.",
    /** Followed by the radical's Japanese name, if any, then `radicalItselfTail`. */
    radicalItself: "It is a radical itself",
    radicalItselfTail: ": dictionaries file other kanji under it.",
    radical: "Radical",
    radicalHidden: "the part dictionaries file it under, even though it is hard to see here.",
    seeAgainIn: "You will see it again in",
    partOf: "A part of",
    partsHelpTitle: "What are radicals and parts?",
    partsHelpBody:
      "Most kanji are put together from a few hundred recurring parts. Know what the parts mean and a new character becomes a short story instead of a tangle of strokes.",
    partsHelpRadical: ({ strong, jp }: Markup): ReactNode => (
      <>
        One part is the {strong("radical")}: the part a dictionary files the character under. It
        often hints at the meaning — {jp("亻")} for people, {jp("氵")} for water, {jp("言")} for
        speech — though not always.
      </>
    ),
    lesson: (n: number) => `Lesson ${n}`,
    usually: (meaning: string) => `usually ${meaning}`,
    radicalBadge: "Radical",
    newPart: "New part",
    seenIn: (lesson: number) => `seen in lesson ${lesson}`,
    /** Between `seenIn` and the kanji the part was first seen in. */
    seenInKanji: ", in ",
  },

  diagram: {
    label: (char: string) => `Stroke order for ${char}`,
    replay: "Replay stroke order",
  },

  writing: {
    eyebrow: "Write it from memory",
    yourWriting: "Your writing",
    model: "Model",
    progress: (drawn: number, expected: number, matches: boolean) =>
      `${drawn} of ${expected} strokes${matches ? " — count matches" : ""}`,
    undo: "Undo",
    clear: "Clear",
    undoAndFollow: " Undo it and follow the green guide.",
    follow: " Follow the green guide.",
    hintsOn: "Hints are on: each stroke is checked as you draw it.",
    showAnswer: "Show the Answer",
    alreadyWriteTitle: (char: string) => `Mark ${char} as one you can write, and skip it`,
    alreadyWrite: "I Can Already Write It",
    checking: "Checking your writing…",
    outOf: "/ 100",
    verdict: {
      clear: "Clear",
      readable: "Readable",
      hard: "Hard to read",
      unreadable: "Not readable yet",
    } satisfies Record<Verdict, string>,
    note: noteEn,
    showAll: (n: number) => `Show All ${n}`,
    nothingToFix: "Nothing to fix: the strokes, their order and their direction all match.",
    suggested: (pass: boolean) =>
      `${pass ? "This looks right, so Next is suggested" : "This does not look right yet, so Retry is suggested"}. It is only an automatic check, and it can be wrong.`,
    needScore: (min: number) =>
      `Your writing needs to score at least ${min} before you go on. Compare it with the model and retry.`,
    compare:
      "Compare your writing with the model. The call is yours: if it looks good enough to you, press Next. If not, Retry.",
    retrying: "Try it again. The last attempt counts as a miss.",
    retry: "Retry",
    next: "Next",
  },
};

const id: typeof en = {
  on: "On",
  kun: "Kun",
  strokes: (n) => `${n} goresan`,

  page: {
    eyebrow: (count, levels) => `Semua ${count} kanji, ${levels.join(" dan ")}`,
    heading: (known, total) => `${known} dari ${total} karakter sudah kamu tahu.`,
    introWriting:
      "Sesuai urutan kurikulum. Kotak berwarna adalah karakter yang sudah kamu tahu — sebagian besar katanya sudah kamu tahu; titik menandai karakter yang juga bisa kamu tulis dari ingatan. Pilih karakter mana pun untuk melihat urutan goresan, cara baca, dan kosakatanya.",
    intro:
      "Sesuai urutan kurikulum. Kotak berwarna adalah karakter yang sudah kamu tahu — sebagian besar katanya sudah kamu tahu. Pilih karakter mana pun untuk melihat urutan goresan, cara baca, dan kosakatanya.",
  },

  explorer: {
    levelCount: (level, n) => `${level} · ${n} kanji`,
    canWriteDot: "bisa ditulis",
    canWrite: "Bisa menulis",
    wordsKnown: (known, total) => `${known} dari ${total} katanya sudah tahu`,
    markReading: (char) => `Saya Tahu ${char}`,
    markedReading: "Ditandai sudah tahu",
    markReadingTitle: (char) => `Tandai kata-kata untuk ${char} sebagai sudah tahu`,
    markWriting: (char) => `Saya Bisa Menulis ${char}`,
    markedWriting: "Menulis ditandai sudah tahu",
    taughtIn: (level, order) => `${level} · Diajarkan di pelajaran ${order}`,
    wordsUseIt: (n) => `${n} kata memakainya`,
  },

  anatomy: {
    radicalTag: " · radikal",
    howToRemember: "Cerita pengingat",
    builtFrom: "Tersusun dari",
    basicShape: "Bentuk dasar",
    notBuilt: "Tidak tersusun dari bagian yang lebih kecil — kanji ini sendiri salah satu bagian penyusun kanji lain.",
    radicalItself: "Kanji ini sendiri sebuah radikal",
    radicalItselfTail: ": kamus mengelompokkan kanji lain di bawahnya.",
    radical: "Radikal",
    radicalHidden: "bagian yang dipakai kamus untuk mengelompokkannya, meski sulit terlihat di sini.",
    seeAgainIn: "Kamu akan menemuinya lagi di",
    partOf: "Bagian dari",
    partsHelpTitle: "Apa itu radikal dan bagian?",
    partsHelpBody:
      "Sebagian besar kanji tersusun dari beberapa ratus bagian yang berulang. Kalau kamu tahu arti bagian-bagiannya, karakter baru menjadi cerita pendek, bukan kumpulan goresan yang membingungkan.",
    partsHelpRadical: ({ strong, jp }) => (
      <>
        Salah satu bagiannya adalah {strong("radikal")}: bagian yang dipakai kamus untuk
        mengelompokkan karakter. Radikal sering memberi petunjuk arti — {jp("亻")} untuk orang,{" "}
        {jp("氵")} untuk air, {jp("言")} untuk ucapan — meski tidak selalu.
      </>
    ),
    lesson: (n) => `Pelajaran ${n}`,
    usually: (meaning) => `biasanya ${meaning}`,
    radicalBadge: "Radikal",
    newPart: "Bagian baru",
    seenIn: (lesson) => `sudah muncul di pelajaran ${lesson}`,
    seenInKanji: ", di ",
  },

  diagram: {
    label: (char) => `Urutan goresan ${char}`,
    replay: "Putar ulang urutan goresan",
  },

  writing: {
    eyebrow: "Tulis dari ingatan",
    yourWriting: "Tulisanmu",
    model: "Contoh",
    progress: (drawn, expected, matches) =>
      `${drawn} dari ${expected} goresan${matches ? " — jumlahnya sudah pas" : ""}`,
    undo: "Urungkan",
    clear: "Hapus",
    undoAndFollow: " Urungkan, lalu ikuti panduan hijau.",
    follow: " Ikuti panduan hijau.",
    hintsOn: "Petunjuk aktif: setiap goresan diperiksa saat kamu menulisnya.",
    showAnswer: "Tampilkan Jawaban",
    alreadyWriteTitle: (char) => `Tandai ${char} sebagai kanji yang sudah bisa kamu tulis, lalu lewati`,
    alreadyWrite: "Saya Sudah Bisa Menulisnya",
    checking: "Memeriksa tulisanmu…",
    outOf: "/ 100",
    verdict: {
      clear: "Jelas",
      readable: "Terbaca",
      hard: "Sulit dibaca",
      unreadable: "Belum terbaca",
    },
    note: noteId,
    showAll: (n) => `Tampilkan Semua (${n})`,
    nothingToFix: "Tidak ada yang perlu diperbaiki: goresan, urutan, dan arahnya sudah sesuai.",
    suggested: (pass) =>
      `${pass ? "Tulisanmu tampak benar, jadi disarankan Lanjut" : "Tulisanmu tampak belum benar, jadi disarankan Ulangi"}. Ini hanya pemeriksaan otomatis dan bisa keliru.`,
    needScore: (min) =>
      `Tulisanmu perlu skor minimal ${min} sebelum kamu bisa lanjut. Bandingkan dengan contoh, lalu ulangi.`,
    compare:
      "Bandingkan tulisanmu dengan contohnya. Kamu sendiri yang menentukan: kalau menurutmu sudah cukup baik, tekan Lanjut. Kalau belum, Ulangi.",
    retrying: "Coba tulis sekali lagi. Percobaan tadi dihitung salah.",
    retry: "Ulangi",
    next: "Lanjut",
  },
};

export const kanji = { en, id };
