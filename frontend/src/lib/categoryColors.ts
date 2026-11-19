import { EventCategory } from "./types";

/**
 * One hue per category, used for the card kicker, the filter dot and the map
 * pin. This is a functional data-encoding system, not a second brand accent:
 * signal yellow stays the only brand color, these only ever distinguish categories
 * from one another.
 *
 * Lightness and chroma are set per theme so every category clears 4.5:1 on
 * the page surfaces regardless of hue.
 */
const HUE: Record<EventCategory, number> = {
  music: 318,
  nightlife: 288,
  arts: 348,
  tech: 232,
  business: 212,
  education: 262,
  sports: 148,
  outdoor: 128,
  health: 172,
  food: 62,
  family: 100,
  community: 86,
  other: 196,
};

export interface CategoryColor {
  /** Vivid, readable on any app surface. */
  color: string;
  /** Translucent tint of the same hue, for fills behind the color. */
  wash: string;
  /** Halo used by map pins. */
  halo: string;
}

/**
 * For CSS: lightness and chroma come from the theme (--cat-l, --cat-c in
 * tokens.css), so the same hue reads on paper by day and on the board at night.
 */
export function getCategoryColor(category: EventCategory): CategoryColor {
  const hue = HUE[category] ?? HUE.other;
  const c = category === "other" ? "calc(var(--cat-c) * 0.35)" : "var(--cat-c)";
  return {
    color: `oklch(var(--cat-l) ${c} ${hue})`,
    wash: `oklch(var(--cat-l) ${c} ${hue} / 0.14)`,
    halo: `oklch(var(--cat-l) ${c} ${hue} / 0.18)`,
  };
}

/**
 * Literal colours for places CSS variables cannot reach: the WebGL map (always
 * the night board) and server-rendered images. Lightness 0.80 clears 4.5:1 on
 * the board.
 */
export function getCategoryColorFixed(category: EventCategory): CategoryColor {
  const hue = HUE[category] ?? HUE.other;
  const chroma = category === "other" ? 0.04 : 0.11;
  return {
    color: `oklch(0.80 ${chroma} ${hue})`,
    wash: `oklch(0.80 ${chroma} ${hue} / 0.14)`,
    halo: `oklch(0.80 ${chroma} ${hue} / 0.18)`,
  };
}
