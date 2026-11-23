"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * The last resort, when the site's own layout fails: no stylesheets or
 * fonts can be relied on here, so it is plain and styled inline.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a152a", color: "#f3f0e7", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 520, padding: 24 }}>
          <p style={{ color: "#fcd726", letterSpacing: "0.2em", fontSize: 12, fontWeight: 700, margin: 0 }}>ELSEWHERE</p>
          <h1 style={{ fontSize: 40, lineHeight: 1.05, margin: "12px 0" }}>Signal failure</h1>
          <p style={{ color: "#a7b2c1", lineHeight: 1.5 }}>The site hit a problem loading. It has been reported, and trying again usually works.</p>
          <p style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button type="button" onClick={reset} style={{ padding: "12px 20px", background: "#fcd726", color: "#0a152a", border: 0, fontWeight: 700, cursor: "pointer" }}>
              Try again
            </button>
            {/* A full reload on purpose: the app shell itself failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ padding: "12px 20px", color: "#f3f0e7", border: "1px solid #a7b2c1", textDecoration: "none" }}>Home</a>
          </p>
        </main>
      </body>
    </html>
  );
}
