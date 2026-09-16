/** Strings for the shell namespace. See ./index.ts for the conventions. */

const en = {
  nav: {
    home: "Home",
    lessons: "Lessons",
    review: "Review",
    kanji: "Kanji",
    practice: "Practice",
  },
  settings: "Settings",
  settingsFor: (name: string) => `Settings for ${name || "your account"}`,
  learner: "Learner",
  signIn: "Sign In",
  signOut: "Sign out",
  guestTitle: "You are studying as a guest.",
  guestBody: "Lessons and practice work in full, but nothing you answer is saved.",
  guestSignIn: "Sign in to keep your progress",
  theme: {
    switch: "Switch theme",
    toLight: "Switch to light theme",
    toDark: "Switch to dark theme",
    light: "Light theme",
    dark: "Dark theme",
  },
  lessonStatus: {
    not_started: "Not started",
    learning: "In progress",
    completed: "Completed",
  },
  kanjiKnown: (known: number, total: number) => `${known} of ${total} kanji known`,
  due: (n: number) => `${n} due`,
  undo: "Undo",
  switchLanguage: (name: string) => `Switch language to ${name}`,
};

const id: typeof en = {
  nav: {
    home: "Beranda",
    lessons: "Pelajaran",
    review: "Ulasan",
    kanji: "Kanji",
    practice: "Latihan",
  },
  settings: "Pengaturan",
  settingsFor: (name: string) => `Pengaturan untuk ${name || "akunmu"}`,
  learner: "Pelajar",
  signIn: "Masuk",
  signOut: "Keluar",
  guestTitle: "Kamu belajar sebagai tamu.",
  guestBody: "Pelajaran dan latihan bisa dipakai sepenuhnya, tetapi jawabanmu tidak disimpan.",
  guestSignIn: "Masuk agar progresmu tersimpan",
  theme: {
    switch: "Ganti tema",
    toLight: "Ganti ke tema terang",
    toDark: "Ganti ke tema gelap",
    light: "Tema terang",
    dark: "Tema gelap",
  },
  lessonStatus: {
    not_started: "Belum dimulai",
    learning: "Sedang berjalan",
    completed: "Selesai",
  },
  kanjiKnown: (known: number, total: number) => `${known} dari ${total} kanji sudah kamu tahu`,
  due: (n: number) => `${n} perlu diulas`,
  undo: "Urungkan",
  switchLanguage: (name: string) => `Ganti bahasa ke ${name}`,
};

export const shell = { en, id };
