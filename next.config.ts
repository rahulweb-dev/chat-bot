import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["mongoose", "bcryptjs", "nodemailer"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          // Short + must-revalidate: a fix here should reach visitors within a
          // minute of deploying, not sit cached for up to an hour (the previous
          // max-age=3600). Still cheap to serve — it's a ~40KB static file and
          // revalidation just returns a 304 when nothing's changed.
          { key: "Cache-Control", value: "public, max-age=60, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
