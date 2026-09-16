/**
 * Errors the API can return that a learner may actually read. Messages about
 * malformed requests stay in English: only a bug in the app sends one.
 * See ./index.ts for the conventions.
 */

const en = {
  notSignedIn: "Not signed in",
  unknownLesson: "Unknown lesson",
  unknownWord: "Unknown word",
  unknownKanji: "Unknown kanji",
  nothingToMark: "Nothing to mark",
  quizClosed: "That quiz is closed",
  noSuchQuestion: "No such question",
  notAnOption: "Not one of the options",
};

const id: typeof en = {
  notSignedIn: "Kamu belum masuk",
  unknownLesson: "Pelajaran tidak dikenal",
  unknownWord: "Kata tidak dikenal",
  unknownKanji: "Kanji tidak dikenal",
  nothingToMark: "Tidak ada yang bisa ditandai",
  quizClosed: "Kuis itu sudah ditutup",
  noSuchQuestion: "Pertanyaan tidak ditemukan",
  notAnOption: "Bukan salah satu pilihan",
};

export const api = { en, id };
