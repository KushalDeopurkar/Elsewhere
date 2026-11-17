"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

/**
 * The event page hero, shot like a trailer: the poster drifts in slowly, and
 * as you scroll past it black letterbox bars close in from the top and
 * bottom while the frame dims. Transform and opacity only. Reduced motion
 * gets the still poster.
 */
export default function TrailerMedia({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 72px", "end start"] });
  const bars = useTransform(scrollYProgress, [0, 0.55], [0, 1]);
  const dim = useTransform(scrollYProgress, [0.1, 0.8], [0, 0.55]);
  const lift = useTransform(scrollYProgress, [0, 1], [1, 1.06]);

  return (
    <div ref={ref} className={`detail-media is-trailer${still ? " is-still" : ""}`}>
      <motion.div className="trailer-zoom" style={still ? undefined : { scale: lift }}>
        {children}
      </motion.div>
      {!still && (
        <>
          <motion.span className="trailer-dim" style={{ opacity: dim }} aria-hidden="true" />
          <motion.span className="trailer-bar is-top" style={{ scaleY: bars }} aria-hidden="true" />
          <motion.span className="trailer-bar is-bottom" style={{ scaleY: bars }} aria-hidden="true" />
        </>
      )}
    </div>
  );
}
