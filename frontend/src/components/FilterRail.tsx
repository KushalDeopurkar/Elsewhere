"use client";

import { useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import { CATEGORIES, EventCategory } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";

export type TimeWindow = "any" | "today" | "tomorrow" | "weekend";

const WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "This weekend" },
];

export function TimeRail({
  value,
  onChange,
}: {
  value: TimeWindow;
  onChange: (next: TimeWindow) => void;
}) {
  return (
    <div className="rail no-scrollbar" role="group" aria-label="Filter by date">
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          type="button"
          className="chip"
          aria-pressed={value === w.value}
          onClick={() => onChange(w.value)}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The category row is wider than most screens. It fades only on the side
 * that has more, a mouse wheel scrolls it sideways, and on pointer screens
 * arrow buttons step through it (touch screens just swipe).
 */
export function CategoryRail({
  value,
  onChange,
}: {
  value: EventCategory | null;
  onChange: (next: EventCategory | null) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const measure = () =>
      setEdges({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    const onWheel = (ev: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;
      const before = el.scrollLeft;
      el.scrollLeft += ev.deltaY;
      if (el.scrollLeft !== before) ev.preventDefault();
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, []);

  const step = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className={`rail-scroller${edges.start ? " at-start" : ""}${edges.end ? " at-end" : ""}`}>
      <button type="button" className="rail-step is-prev" onClick={() => step(-1)} aria-label="Earlier categories" tabIndex={-1} hidden={edges.start}>
        <CaretLeft size={14} weight="bold" aria-hidden="true" />
      </button>
      <div ref={rail} className="rail no-scrollbar" role="tablist" aria-label="Filter by category">
        <button
          type="button"
          role="tab"
          className="chip"
          aria-selected={value === null}
          onClick={(ev) => {
            ev.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest" });
            onChange(null);
          }}
        >
          Everything
        </button>
        {CATEGORIES.filter((c) => c.value !== "other").map((cat) => (
          <button
            key={cat.value}
            type="button"
            role="tab"
            className="chip"
            aria-selected={value === cat.value}
            onClick={(ev) => {
              ev.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest" });
              onChange(value === cat.value ? null : cat.value);
            }}
            style={
              { "--chip-hue": getCategoryColor(cat.value).color } as React.CSSProperties
            }
          >
            <span className="chip-dot" aria-hidden="true" />
            {cat.label}
          </button>
        ))}
      </div>
      <button type="button" className="rail-step is-next" onClick={() => step(1)} aria-label="More categories" tabIndex={-1} hidden={edges.end}>
        <CaretRight size={14} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
}
