import type { EventCategory } from "@/lib/types";

type World = "bars" | "grid" | "steam" | "lines" | "blobs" | "stars" | "breath" | "bubbles" | "glow";

const WORLD: Record<EventCategory, World> = {
  music: "bars",
  nightlife: "bars",
  tech: "grid",
  business: "grid",
  food: "steam",
  sports: "lines",
  outdoor: "lines",
  arts: "blobs",
  education: "stars",
  health: "breath",
  community: "bubbles",
  family: "bubbles",
  other: "glow",
};

/** A small, fixed pseudo-random sequence so the server and client agree. */
const seq = (n: number, k: number) => Array.from({ length: n }, (_, i) => ((i * 7919 + k * 104729) % 997) / 997);

/**
 * Each category page gets its own animated backdrop behind the header:
 * sound bars for music, a glowing grid for tech, rising steam for food...
 * Pure CSS (transform and opacity), decorative, and still under reduced
 * motion.
 */
export default function CategoryWorld({ category }: { category: EventCategory }) {
  const w = WORLD[category] ?? "glow";
  const r = seq(18, w.length);
  return (
    <div className={`cworld is-${w}`} aria-hidden="true">
      {w === "bars" &&
        Array.from({ length: 28 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${-r[i % 18] * 1.6}s`, animationDuration: `${0.9 + r[(i + 5) % 18] * 1.1}s` }} />
        ))}
      {w === "grid" && <span className="cw-scan" />}
      {w === "steam" &&
        Array.from({ length: 7 }, (_, i) => (
          <span key={i} style={{ left: `${48 + i * 7}%`, animationDelay: `${-r[i] * 6}s` }} />
        ))}
      {w === "lines" &&
        Array.from({ length: 9 }, (_, i) => (
          <span key={i} style={{ top: `${8 + i * 10}%`, animationDelay: `${-r[i] * 3}s`, width: `${18 + r[i + 3] * 30}%` }} />
        ))}
      {w === "blobs" && [0, 1, 2].map((i) => <span key={i} />)}
      {w === "stars" &&
        Array.from({ length: 26 }, (_, i) => (
          <span key={i} style={{ left: `${40 + r[i % 18] * 58}%`, top: `${6 + r[(i + 7) % 18] * 85}%`, animationDelay: `${-r[(i + 2) % 18] * 4}s` }} />
        ))}
      {w === "breath" && [0, 1, 2].map((i) => <span key={i} style={{ animationDelay: `${-i * 2}s` }} />)}
      {w === "bubbles" &&
        Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ left: `${42 + r[i] * 56}%`, width: `${10 + r[i + 4] * 26}px`, animationDelay: `${-r[(i + 9) % 18] * 9}s` }} />
        ))}
    </div>
  );
}
