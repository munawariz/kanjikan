import type { Metadata, Viewport } from "next";
import { ThemeScript } from "@/components/app/ThemeScript";
import "@/styles/atlas/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanjikan — Learn Japanese words, not just characters",
  description:
    "Work through JLPT vocabulary word by word, with spaced repetition and a progress checkpoint that follows you across devices.",
};

/**
 * Tints the phone's browser chrome to match the page, so the status bar does
 * not sit as a white band above a dark app. The values are the light and dark
 * --surface-page; they cannot reference the CSS variable because the browser
 * reads this before any stylesheet.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#06120b" },
  ],
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
