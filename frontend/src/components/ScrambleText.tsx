"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Text that resolves out of scrambled letters when it changes, like an LED
 * departures line. Writes to the DOM directly; reduced motion shows it
 * plainly. The real text is in the server render, so nothing is lost
 * without JavaScript.
 */
export default function ScrambleText({ text, delay = 0, className = "" }: { text: string; delay?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    // Resolve on first appearance and whenever the text changes.
    if (!el || shown.current === text) return;
    shown.current = text;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = text;
      return;
    }
    let raf = 0;
    const t0 = performance.now() + delay;
    const dur = Math.min(520, 160 + text.length * 12);
    const step = (now: number) => {
      const p = Math.max(0, (now - t0) / dur);
      if (p >= 1) {
        el.textContent = text;
        return;
      }
      const fixed = Math.floor(text.length * p);
      let out = text.slice(0, fixed);
      for (let i = fixed; i < text.length; i++) {
        const c = text[i];
        out += c === " " ? " " : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = out;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, delay]);

  return (
    <span ref={ref} className={className} aria-hidden="true">
      {text}
    </span>
  );
}
