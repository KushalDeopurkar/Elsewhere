"use client";

import { useEffect, useRef } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:₹$£€+";

/**
 * Split-flap tiles: one tile per character, padded to `length`. When the
 * text changes, each tile riffles through a few characters and lands on its
 * new one, left to right, like a station board. The riffle writes straight
 * to the DOM (no React state per frame) and is skipped for reduced motion.
 */
export default function FlapText({
  text,
  length,
  delay = 0,
  className = "",
  label,
}: {
  text: string;
  /** What a screen reader hears instead of the tiles; defaults to the text. */
  label?: string;
  length: number;
  delay?: number;
  className?: string;
}) {
  const target = text.toUpperCase().slice(0, length).padEnd(length, " ");
  const tiles = useRef<(HTMLSpanElement | null)[]>([]);
  const first = useRef(true);

  useEffect(() => {
    const els = tiles.current;
    if (first.current && !text.trim()) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      els.forEach((el, i) => el && (el.textContent = target[i]));
      first.current = false;
      return;
    }
    first.current = false;
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      let busy = false;
      els.forEach((el, i) => {
        if (!el) return;
        const settle = t0 + 90 + i * 32;
        if (now >= settle) {
          // Always land: the riffle may already show the right character.
          if (el.textContent !== target[i]) el.textContent = target[i];
          el.classList.remove("is-flipping");
        } else {
          busy = true;
          if (now >= t0 + i * 18 && target[i] !== " ") {
            el.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
            el.classList.add("is-flipping");
          }
        }
      });
      if (busy) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, text]);

  return (
    <span className={`flap ${className}`}>
      <span className="sr-only">{label ?? text}</span>
      {target.split("").map((c, i) => (
        <span
          key={i}
          ref={(el) => {
            tiles.current[i] = el;
          }}
          className={`flap-t${c === " " ? " is-blank" : ""}${c === ":" ? " is-sep" : ""}`}
          aria-hidden="true"
        >
          {c}
        </span>
      ))}
    </span>
  );
}
