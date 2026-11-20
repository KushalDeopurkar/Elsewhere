"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders its children once they come within a screen of the viewport. Home
 * has many rails of tickets; building them all on first load blocks the main
 * thread on phones. The placeholder keeps the page's height so nothing jumps.
 */
export default function WhenNear({ children, minHeight = 480 }: { children: React.ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return near ? <>{children}</> : <div ref={ref} style={{ minHeight }} aria-hidden="true" />;
}
