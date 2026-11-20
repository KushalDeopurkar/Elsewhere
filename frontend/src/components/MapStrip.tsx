"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import EventImage from "./EventImage";
import { whenOf } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import { getCategoryColor } from "@/lib/categoryColors";
import type { Event } from "@/lib/types";

const SETTLE_MS = 160;

/**
 * Phone map: a swipeable row of event cards along the bottom. Whichever card
 * settles in the middle is selected and the map glides to its venue; tapping
 * a pin scrolls its card into place. Hidden on wide screens, which have the
 * side list instead.
 */
export default function MapStrip({
  events,
  selectedId,
  onFocus,
}: {
  events: Event[];
  selectedId: string | null;
  onFocus: (event: Event) => void;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const settle = useRef<number | null>(null);
  // Scrolls we start ourselves (following a pin tap) shouldn't select again.
  const steering = useRef(false);
  const lastFocused = useRef<string | null>(null);

  const centred = (): Event | null => {
    const ul = ref.current;
    if (!ul) return null;
    const mid = ul.scrollLeft + ul.clientWidth / 2;
    let best: Event | null = null;
    let bestD = Infinity;
    ul.querySelectorAll<HTMLElement>("[data-id]").forEach((li, i) => {
      const d = Math.abs(li.offsetLeft + li.offsetWidth / 2 - mid);
      if (d < bestD) {
        bestD = d;
        best = events[i] ?? null;
      }
    });
    return best;
  };

  const onScroll = () => {
    if (settle.current) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      if (steering.current) {
        steering.current = false;
        return;
      }
      const e = centred();
      if (e && e.id !== selectedId) {
        lastFocused.current = e.id;
        onFocus(e);
      }
    }, SETTLE_MS);
  };

  // A pin was tapped (or the list was used): bring that card to the middle.
  useEffect(() => {
    const ul = ref.current;
    if (!ul || !selectedId || lastFocused.current === selectedId) return;
    const li = ul.querySelector<HTMLElement>(`[data-id="${CSS.escape(selectedId)}"]`);
    if (!li) return;
    lastFocused.current = selectedId;
    steering.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ul.scrollTo({ left: li.offsetLeft - (ul.clientWidth - li.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [selectedId]);

  useEffect(() => () => {
    if (settle.current) window.clearTimeout(settle.current);
  }, []);

  if (events.length === 0) return null;
  return (
    <ul ref={ref} className="map-strip" aria-label="Events on the map, swipe to browse" onScroll={onScroll}>
      {events.map((e) => {
        const on = e.id === selectedId;
        return (
          <li
            key={e.id}
            data-id={e.id}
            className={`map-strip-card${on ? " is-on" : ""}`}
            style={{ "--cat-hue": getCategoryColor(e.category).color } as React.CSSProperties}
          >
            <button
              type="button"
              className="map-strip-main"
              aria-pressed={on}
              onClick={() => {
                lastFocused.current = e.id;
                onFocus(e);
              }}
            >
              <span className="map-strip-thumb">
                <EventImage src={e.image_url} category={e.category} ratio="1 / 1" width={96} />
              </span>
              <span className="map-strip-body">
                <span className="map-strip-title">{e.title}</span>
                <span className="map-strip-meta">{whenOf(e)}</span>
                <span className="map-strip-meta">
                  {priceBadge(e)}
                  {e.location_name ? ` · ${e.location_name}` : ""}
                </span>
              </span>
            </button>
            <Link href={`/events/${e.id}`} prefetch={false} className="map-strip-open" aria-label={`Open ${e.title}`}>
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
