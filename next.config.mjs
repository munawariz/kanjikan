/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      // The progress page was folded into the dashboard. Kept so bookmarks
      // and installed-app shortcuts to it still land somewhere useful.
      { source: "/progress", destination: "/dashboard", permanent: true },
    ];
  },
};

export default nextConfig;
