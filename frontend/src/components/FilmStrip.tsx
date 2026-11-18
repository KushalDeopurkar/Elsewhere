"use client";

import { useRef } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import EventCard from "./EventCard";
import type { Night } from "@/lib/nights";

/**
 * Explore as a reel: one horizontal strip per night, snapping card to card,
 * with a title card for each night. Native scroll-snap (no carousel
 * library), arrow buttons for mouse users, and rows render lazily
 * (content-visibility) so long reels stay cheap.
 */
export default function FilmStrip({ nights, badgeFor }: { nights: Night[]; badgeFor?: (id: string) => string | undefined }) {
  return (
    <div className="reel">
      {nights.map((n, i) => (
        <Strip key={n.key} night={n} index={i} badgeFor={badgeFor} />
      ))}
    </div>
  );
}

function Strip({ night, index, badgeFor }: { night: Night; index: number; badgeFor?: (id: string) => string | undefined }) {
  const track = useRef<HTMLDivElement>(null);
  const move = (dir: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const id = `reel-${night.key}`;
  return (
    <section className="reel-night" aria-labelledby={id}>
      <header className="reel-head">
        <p className="reel-num" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </p>
        <h2 id={id} className="reel-title">
          {night.label}
        </h2>
        <p className="reel-count">
          {night.events.length} event{night.events.length === 1 ? "" : "s"}
        </p>
        {night.events.length > 2 && (
          <div className="reel-arrows">
            <button type="button" className="icon-btn" aria-label={`Scroll ${night.label} back`} onClick={() => move(-1)}>
              <CaretLeft size={16} weight="bold" />
            </button>
            <button type="button" className="icon-btn" aria-label={`Scroll ${night.label} forward`} onClick={() => move(1)}>
              <CaretRight size={16} weight="bold" />
            </button>
          </div>
        )}
      </header>
      <div className="reel-film">
        <div className="reel-track" ref={track} tabIndex={-1}>
          {night.events.map((e, i) => (
            <div className="reel-frame" key={e.id}>
              <EventCard event={e} priority={index === 0 && i < 3} badge={badgeFor?.(e.id)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
