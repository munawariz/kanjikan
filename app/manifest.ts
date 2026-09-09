import type { MetadataRoute } from "next";

/**
 * Web app manifest.
 *
 * Installability needs all of: a name, 192px and 512px icons, a start_url, a
 * standalone display mode, and a registered service worker with a fetch
 * handler. All five are present; drop any one and the install prompt stops
 * appearing with no error to explain why.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kanjikan — Remember every JLPT kanji",
    short_name: "Kanjikan",
    description:
      "Learn the JLPT N5 kanji five at a time, with stroke order, the words that fix their readings, and writing practice from memory.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#003511",
    theme_color: "#003511",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops icons to its own shape; the maskable variant keeps the
      // glyph inside the safe zone so the crop never clips it.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Review", short_name: "Review", url: "/review" },
      { name: "Writing practice", short_name: "Writing", url: "/writing" },
      { name: "Lessons", short_name: "Lessons", url: "/lessons" },
    ],
  };
}
