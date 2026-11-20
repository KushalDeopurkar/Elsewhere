"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * The event couldn't be read (the listings service and the database were
 * both unreachable). Try once more on its own after a few seconds, since
 * that is usually a cold start, and offer a retry button.
 */
export default function EventError({ reset }: { error: Error; reset: () => void }) {
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    const t = window.setTimeout(reset, 4000);
    return () => window.clearTimeout(t);
  }, [reset]);
  return (
    <section className="shell" style={{ textAlign: "center", padding: "6rem 1rem" }} role="alert">
      <h1>This event is taking a moment</h1>
      <p>The listings service is waking up. Trying again in a few seconds.</p>
      <p style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1.5rem" }}>
        <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
        <Link href="/explore" className="btn">Back to events</Link>
      </p>
    </section>
  );
}
