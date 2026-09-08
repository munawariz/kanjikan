import type { Metadata } from "next";
import { ThemeScript } from "@/components/app/ThemeScript";
import "@/styles/atlas/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanjikan — Learn Japanese words, not just characters",
  description:
    "Work through JLPT vocabulary word by word, with spaced repetition and a progress checkpoint that follows you across devices.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
