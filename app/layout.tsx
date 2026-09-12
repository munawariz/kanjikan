import type { Metadata, Viewport } from "next";
import { ThemeScript } from "@/components/app/ThemeScript";
import { TimeZoneScript } from "@/components/app/TimeZoneScript";
import { ServiceWorker } from "@/components/app/ServiceWorker";
import "@/styles/atlas/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  // Fixed, and deliberately not per-page: a tab that always reads Kanjikan is
  // how the app is found among a row of open tabs. Pages do not override it —
  // a title here is the one the whole app wears.
  title: "Kanjikan",
  description:
    "Learn the JLPT N5 kanji five at a time, with stroke order, the words that fix their readings, and writing practice from memory.",
  applicationName: "Kanjikan",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    // iOS ignores the manifest's icons for a home-screen shortcut and reads
    // this link instead, so without it an installed app gets a screenshot of
    // the page as its icon.
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Kanjikan",
    // Lets the forest header run under the status bar rather than leaving a
    // white strip above it.
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
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
        <TimeZoneScript />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
