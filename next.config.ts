import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Electron loads the static export from out/.
  output: "export",
  devIndicators: false,
  images: { unoptimized: true },
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
