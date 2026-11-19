"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * Headline ending that cycles, letter by letter. Screen readers get the
 * first word only (the caller renders it in sr-only text); this is visual.
 */
export default function KineticWord({ words, every = 2600 }: { words: string[]; every?: number }) {
  const reduce = useReducedMotion() ?? false;
  const [i, setI] = useState(0);

  // Hold the first word a while: the headline is the page's main paint, and
  // swapping its letters straight away delays when the page counts as loaded.
  useEffect(() => {
    if (reduce) return;
    let id = 0;
    const start = window.setTimeout(() => {
      setI((n) => (n + 1) % words.length);
      id = window.setInterval(() => setI((n) => (n + 1) % words.length), every);
    }, Math.max(every, 5000));
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, [reduce, words.length, every]);

  const word = words[reduce ? 0 : i];
  return (
    <em className="kinetic" aria-hidden="true">
      {/* Invisible copies of every word share one grid cell, so the box is
          always as wide as the longest word and the headline never reflows. */}
      {words.map((w) => (
        <span key={w} className="kinetic-sizer">
          {w}
        </span>
      ))}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={word} className="kinetic-word">
          {Array.from(word).map((ch, k) => (
            <motion.span
              key={k}
              className="kinetic-ch"
              initial={{ y: "105%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              exit={{ y: "-105%", opacity: 0 }}
              transition={{ duration: 0.5, delay: k * 0.028, ease: [0.16, 1, 0.3, 1] }}
            >
              {ch === " " ? " " : ch}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </em>
  );
}
