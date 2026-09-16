/** Strings for the auth namespace. See ./index.ts for the conventions. */
import type { ReactNode } from "react";

const en = {
  login: {
    eyebrow: "Welcome",
    title: "Sign in or start learning",
    /** The link is passed in, already carrying its text. */
    guest: (link: ReactNode) => (
      <>
        Not ready for an account? {link}. Nothing you answer will be saved.
      </>
    ),
    guestLink: "Take lessons as a guest",
  },
  layout: {
    headline: "A handful of kanji a lesson, until every one sticks.",
    body: "Stroke order, readings, and the words that fix them. Your place is saved on every card, so you can stop after ninety seconds and pick it up tomorrow.",
    statKanji: "Kanji",
    statLessons: "Lessons",
    statWords: "Words",
  },
  form: {
    username: "Username",
    usernameHint: "Letters, numbers, underscores or hyphens.",
    password: "Password",
    passwordHint: (min: number) => `New accounts need at least ${min} characters.`,
    pending: "One moment…",
    submit: "Continue",
    newHere: "New here? Enter the username you want, and you will be asked before an account is made.",
    dialogEyebrow: "New account",
    dialogTitle: "Create an account?",
    dialogBody: (username: ReactNode) => (
      <>
        No account uses the username {username} yet. An account will be created with this username
        and the password you entered.
      </>
    ),
    dialogNote: "There is no email address to reset it with, so keep the password somewhere safe.",
    create: "Create Account",
    cancel: "Cancel",
  },
  errors: {
    unreachable: "Could not reach the database. Try again in a moment.",
    missing: "Enter a username and password.",
    badUsername: (min: number, max: number) =>
      `Usernames are ${min} to ${max} letters, numbers, underscores or hyphens.`,
    passwordTooLong: (max: number) => `Passwords can be at most ${max} characters.`,
    passwordTooShort: (min: number) => `Use at least ${min} characters for your password.`,
    taken: "That username was taken a moment ago. Choose another.",
    locked: "Too many wrong passwords for that username. Wait a few minutes and try again.",
    wrongPassword: "Wrong password for that username.",
    noAccount: (username: string, min: number) =>
      `There is no account called ${username} yet. To open it, choose a password of at least ${min} characters.`,
  },
  setup: {
    badge: "Not configured yet",
    title: "Three steps and you are learning.",
    intro: (words: number, levels: string[], kanji: number) =>
      `The ${words} ${levels.join(" and ")} words and ${kanji} kanji are already in this repository and need no setup. The database is only there to hold accounts and progress.`,
    steps: [
      {
        title: "Create a Supabase project.",
        body: "Any region; the free tier is enough. Kanjikan only uses its Postgres database — accounts are kept in the app's own tables, not in Supabase Auth.",
      },
      {
        title: "Add the database URL to .env.",
        body: "From the Connect button at the top of the dashboard, copy the Transaction pooler connection string (port 6543) and set it as SUPABASE_DB_URL in .env. Then restart the dev server so Next.js picks it up.",
      },
      {
        title: "Run the migration.",
        body: "npm run migrate creates the tables, the accounts and sessions, and the row level security policies. npm run doctor checks the result.",
      },
    ],
    /** The variable name is passed in, already styled. */
    footer: (variable: ReactNode) => (
      <>
        This page is served for anything that needs an account while {variable} is missing. Lessons
        and practice work without it. Set it and restart, and it redirects to the app on its own.
      </>
    ),
  },
};

const id: typeof en = {
  login: {
    eyebrow: "Selamat datang",
    title: "Masuk atau mulai belajar",
    guest: (link) => (
      <>
        Belum siap membuat akun? {link}. Jawabanmu tidak akan disimpan.
      </>
    ),
    guestLink: "Ikuti pelajaran sebagai tamu",
  },
  layout: {
    headline: "Beberapa kanji per pelajaran, sampai semuanya melekat.",
    body: "Urutan goresan, cara baca, dan kata-kata yang memantapkannya. Posisimu tersimpan di setiap kartu, jadi kamu bisa berhenti setelah sembilan puluh detik dan melanjutkannya besok.",
    statKanji: "Kanji",
    statLessons: "Pelajaran",
    statWords: "Kata",
  },
  form: {
    username: "Nama pengguna",
    usernameHint: "Huruf, angka, garis bawah, atau tanda hubung.",
    password: "Kata sandi",
    passwordHint: (min) => `Akun baru perlu minimal ${min} karakter.`,
    pending: "Sebentar…",
    submit: "Lanjut",
    newHere: "Baru di sini? Masukkan nama pengguna yang kamu inginkan. Kamu akan ditanya dulu sebelum akun dibuat.",
    dialogEyebrow: "Akun baru",
    dialogTitle: "Buat akun?",
    dialogBody: (username) => (
      <>
        Belum ada akun dengan nama pengguna {username}. Akun akan dibuat dengan nama pengguna ini dan
        kata sandi yang kamu masukkan.
      </>
    ),
    dialogNote: "Tidak ada alamat email untuk mengatur ulang kata sandi, jadi simpan kata sandimu di tempat yang aman.",
    create: "Buat Akun",
    cancel: "Batal",
  },
  errors: {
    unreachable: "Tidak dapat terhubung ke database. Coba lagi sebentar lagi.",
    missing: "Masukkan nama pengguna dan kata sandi.",
    badUsername: (min, max) =>
      `Nama pengguna terdiri dari ${min} sampai ${max} huruf, angka, garis bawah, atau tanda hubung.`,
    passwordTooLong: (max) => `Kata sandi maksimal ${max} karakter.`,
    passwordTooShort: (min) => `Gunakan minimal ${min} karakter untuk kata sandimu.`,
    taken: "Nama pengguna itu baru saja dipakai orang lain. Pilih yang lain.",
    locked: "Terlalu banyak kata sandi salah untuk nama pengguna itu. Tunggu beberapa menit, lalu coba lagi.",
    wrongPassword: "Kata sandi salah untuk nama pengguna itu.",
    noAccount: (username, min) =>
      `Belum ada akun bernama ${username}. Untuk membuatnya, pilih kata sandi minimal ${min} karakter.`,
  },
  setup: {
    badge: "Belum dikonfigurasi",
    title: "Tiga langkah, lalu kamu bisa belajar.",
    intro: (words, levels, kanji) =>
      `${words} kata dan ${kanji} kanji ${levels.join(" dan ")} sudah ada di repositori ini dan tidak perlu disiapkan. Database hanya dipakai untuk menyimpan akun dan kemajuan.`,
    steps: [
      {
        title: "Buat proyek Supabase.",
        body: "Region mana pun; paket gratis sudah cukup. Kanjikan hanya memakai database Postgres-nya — akun disimpan di tabel milik aplikasi sendiri, bukan di Supabase Auth.",
      },
      {
        title: "Tambahkan URL database ke .env.",
        body: "Dari tombol Connect di bagian atas dashboard, salin connection string Transaction pooler (port 6543) dan isikan sebagai SUPABASE_DB_URL di .env. Lalu mulai ulang dev server agar Next.js membacanya.",
      },
      {
        title: "Jalankan migrasi.",
        body: "npm run migrate membuat tabel, akun dan sesi, serta kebijakan row level security. npm run doctor memeriksa hasilnya.",
      },
    ],
    footer: (variable) => (
      <>
        Halaman ini muncul untuk semua yang memerlukan akun selama {variable} belum diatur. Pelajaran
        dan latihan tetap bisa dipakai tanpanya. Atur nilainya lalu mulai ulang, dan halaman ini akan
        mengarahkan ke aplikasi dengan sendirinya.
      </>
    ),
  },
};

export const auth = { en, id };
