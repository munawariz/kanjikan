/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      // The progress page was folded into the dashboard. Kept so bookmarks
      // and installed-app shortcuts to it still land somewhere useful.
      { source: "/progress", destination: "/dashboard", permanent: true },
      // Likewise the learning path, which is now the dashboard's lesson chain,
      // and the writing review, which moved into Review.
      { source: "/path", destination: "/dashboard", permanent: true },
      { source: "/writing", destination: "/review", permanent: true },
    ];
  },
};

export default nextConfig;
