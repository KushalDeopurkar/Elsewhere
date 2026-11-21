"use client";

import { useEffect, useRef } from "react";

/**
 * The 1600x1000 box the backdrop's trains run in, scaled to cover the
 * viewport the way the still SVG does ("slice"). The trains' keyframes are
 * plain pixel values in that box, so the compositor runs them; only this
 * scale changes, and only when the window is resized.
 */
export default function BackdropStage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    const fit = () => {
      const s = Math.max(host.clientWidth / 1600, host.clientHeight / 1000);
      el.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="netbg-stage">
      {children}
    </div>
  );
}
