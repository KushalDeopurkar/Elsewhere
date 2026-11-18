"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Event } from "@/lib/types";

const QUERY = "(min-width: 1100px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/** Big screens, a fine pointer, motion allowed, no data saver, and some memory to spare. */
function capable(): boolean {
  if (typeof window === "undefined" || !window.matchMedia(QUERY).matches) return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  return true;
}
const subscribe = (l: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", l);
  return () => mq.removeEventListener("change", l);
};

/**
 * Desktop-only backdrop for the home board: three columns of real event
 * posters drifting slowly in opposite directions, graded down and faded at
 * the edges so the board stays the subject. Loads only once the page is
 * idle, pauses when scrolled away, and is skipped entirely on phones,
 * data-saver connections, low-memory devices and for reduced motion.
 */
export default function PosterWall({ events }: { events: Event[] }) {
  const ok = useSyncExternalStore(subscribe, capable, () => false);
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ok) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true), { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(t);
  }, [ok]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => el.classList.toggle("is-paused", !e.isIntersecting));
    io.observe(el);
    const onVis = () => el.classList.toggle("is-paused", document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ready]);

  const posters = [...new Map(events.filter((e) => e.image_url).map((e) => [e.image_url!, e])).values()].slice(0, 15);
  if (!ok || !ready || posters.length < 6) return null;

  const cols = [0, 1, 2].map((c) => posters.filter((_, i) => i % 3 === c));
  return (
    <div className="pwall" ref={ref} aria-hidden="true">
      {cols.map((col, c) => (
        <div key={c} className={`pwall-col is-${c}`}>
          {/* Twice over, so the loop has no seam. */}
          {[...col, ...col].map((e, i) => (
            <img key={`${e.id}-${i}`} src={e.image_url!} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          ))}
        </div>
      ))}
    </div>
  );
}
