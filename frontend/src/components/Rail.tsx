"use client";

import { useCallback, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";

/**
 * Horizontal collection with scroll-snap. Touch and trackpads scroll it
 * natively; the arrow buttons page it on desktop and hide at either end.
 */
export default function Rail({
  children,
  label,
  size = "standard",
}: {
  children: React.ReactNode;
  label: string;
  size?: "standard" | "wide" | "compact";
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<{ start: boolean; end: boolean }>({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="rail-wrap">
      <div
        ref={track}
        className={`rail-track rail-${size} no-scrollbar`}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={update}
        onPointerEnter={update}
      >
        {children}
      </div>
      <button
        type="button"
        className="rail-arrow is-prev"
        onClick={() => page(-1)}
        aria-label={`Previous ${label}`}
        hidden={edge.start}
      >
        <CaretLeft size={18} weight="bold" />
      </button>
      <button
        type="button"
        className="rail-arrow is-next"
        onClick={() => page(1)}
        aria-label={`More ${label}`}
        hidden={edge.end}
      >
        <CaretRight size={18} weight="bold" />
      </button>
    </div>
  );
}
