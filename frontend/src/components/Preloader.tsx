"use client";

/**
 * First-visit intro on the home page: the wordmark and a counter that runs
 * up to the number of live events in your city, then the curtain lifts.
 *
 * It is server-rendered so it covers the page from the first paint, and a
 * tiny inline script hides it before paint for repeat visits in the same
 * session and for reduced motion. A CSS timeout lifts it even if scripts
 * fail. Click or Escape skips it. Once per device, and short (about 1.2s with the lift). Decorative: aria-hidden.
 */
import { useEffect, useRef, useState } from "react";
import BrandMark from "./BrandMark";

const KEY = "ee.intro.v1";
const GATE = `try{if(localStorage.getItem("${KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("no-intro")}catch(e){document.documentElement.classList.add("no-intro")}`;

export default function Preloader({ count, loading, city }: { count: number; loading: boolean; city: string }) {
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const started = useRef(0);
  const target = useRef(0);
  useEffect(() => {
    target.current = count;
  });

  useEffect(() => {
    if (document.documentElement.classList.contains("no-intro")) {
      const t = window.setTimeout(() => setGone(true), 0);
      return () => window.clearTimeout(t);
    }
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode: show again next time, harmless */
    }
    started.current = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const el = now - started.current;
      const p = Math.min(1, el / 650);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(target.current * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else window.setTimeout(() => setLeaving(true), 150);
    };
    raf = requestAnimationFrame(tick);
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      setLeaving(true);
    };
    window.addEventListener("keydown", skip);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  if (gone) return null;
  const label = `${shown}${count >= 100 && shown === count ? "+" : ""}`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: GATE }} />
      <div
        className={`intro${leaving ? " is-leaving" : ""}`}
        aria-hidden="true"
        onClick={() => setLeaving(true)}
        onTransitionEnd={(e) => {
          if (e.propertyName === "clip-path") setGone(true);
        }}
      >
        <div className="intro-inner">
          <p className="intro-brand">
            <BrandMark className="intro-mark" /> Elsewhere
          </p>
          <p className="intro-count">{label}</p>
          <p className="intro-line">{loading && count === 0 ? `finding what's on in ${city}` : `things happening in ${city}`}</p>
        </div>
        <div className="intro-bar">
          <span style={{ transform: `scaleX(${count ? shown / count : 0})` }} />
        </div>
      </div>
    </>
  );
}
