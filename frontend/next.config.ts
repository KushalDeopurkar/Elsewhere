import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// The browser signs in with Supabase Auth using the project's public anon
// (publishable) key, which is safe to expose: row level security decides
// what each person can read and write. Falls back to the server's names so
// no extra Vercel variables are needed when those are already set.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://gdfhdcjfnrbbtwsfoxea.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
  },
  // Pages folded into others when the site was simplified.
  async redirects() {
    return [
      { source: "/vibe", destination: "/explore", permanent: false },
      { source: "/feed", destination: "/explore", permanent: false },
      { source: "/discover", destination: "/explore", permanent: false },
      { source: "/categories", destination: "/explore", permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
