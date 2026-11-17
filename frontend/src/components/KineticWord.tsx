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

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % words.length), every);
    return () => window.clearInterval(id);
  }, [reduce, words.length, every]);

  const word = words[reduce ? 0 : i];
  return (
    <em className="kinetic" aria-hidden="true">
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
