"use client";

import { useRef } from "react";

/**
 * A 24-hour clock dial for the map's timeline: the hand shows the hour being
 * played; drag it round (or use the arrow keys) to move through the day.
 * Midnight at the top, like a watch with a 24-hour bezel.
 */
export default function TimeDial({
  hourOfDay,
  onChange,
  label,
}: {
  hourOfDay: number;
  onChange: (h: number) => void;
  label: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const fromPointer = (x: number, y: number) => {
    const r = ref.current!.getBoundingClientRect();
    const a = Math.atan2(x - (r.left + r.width / 2), -(y - (r.top + r.height / 2)));
    const deg = ((a * 180) / Math.PI + 360) % 360;
    onChange(Math.round(deg / 15) % 24);
  };

  const angle = (hourOfDay % 24) * 15;
  const night = hourOfDay % 24 >= 19 || hourOfDay % 24 < 5;

  return (
    <svg
      ref={ref}
      className={`tdial${night ? " is-night" : ""}`}
      viewBox="0 0 100 100"
      role="slider"
      tabIndex={0}
      aria-label="Hour of the day"
      aria-valuemin={0}
      aria-valuemax={23}
      aria-valuenow={hourOfDay % 24}
      aria-valuetext={label}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        fromPointer(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => dragging.current && fromPointer(e.clientX, e.clientY)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(((hourOfDay % 24) + 1) % 24);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          onChange(((hourOfDay % 24) + 23) % 24);
        }
      }}
    >
      <circle cx="50" cy="50" r="47" className="tdial-face" />
      {/* Evening arc, 19:00 to 03:00 */}
      <path d={arc(19 * 15, 27 * 15, 41)} className="tdial-night" />
      {Array.from({ length: 24 }, (_, h) => {
        const a = (h * 15 * Math.PI) / 180;
        const r1 = h % 6 === 0 ? 34 : 38;
        return (
          <line
            key={h}
            x1={50 + Math.sin(a) * r1}
            y1={50 - Math.cos(a) * r1}
            x2={50 + Math.sin(a) * 43}
            y2={50 - Math.cos(a) * 43}
            className={h % 6 === 0 ? "tdial-major" : "tdial-minor"}
          />
        );
      })}
      <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "50px 50px" }} className="tdial-hand">
        <line x1="50" y1="54" x2="50" y2="14" />
        <circle cx="50" cy="14" r="4" />
      </g>
      <circle cx="50" cy="50" r="4" className="tdial-hub" />
    </svg>
  );
}

function arc(fromDeg: number, toDeg: number, r: number): string {
  const p = (d: number) => {
    const a = (d * Math.PI) / 180;
    return `${50 + Math.sin(a) * r} ${50 - Math.cos(a) * r}`;
  };
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${p(fromDeg)} A ${r} ${r} 0 ${large} 1 ${p(toDeg)}`;
}
