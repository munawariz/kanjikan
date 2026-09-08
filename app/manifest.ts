import type { MetadataRoute } from "next";

/**
 * Web app manifest, so the app can be installed to a home screen or dock.
 *
 * theme_color is Atlas forest, matching the icon ground, so the browser chrome
 * continues the mark rather than framing it in white.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kanjikan — Learn Japanese words",
    short_name: "Kanjikan",
    description:
      "Work through JLPT vocabulary word by word, with spaced repetition and a progress checkpoint that follows you across devices.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#003511",
    theme_color: "#003511",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
