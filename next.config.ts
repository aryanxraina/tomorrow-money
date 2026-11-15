import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Hide the "N" Next.js dev-tools badge in the corner during `npm run dev`. Errors still show.
  devIndicators: false,
  experimental: {
    // Pages render only after mount because state lives in localStorage (see AppShell), which the
    // dev-only instant-navigation check reports as a dropped segment on every route.
    instantInsights: { validationLevel: 'manual-warning' },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
