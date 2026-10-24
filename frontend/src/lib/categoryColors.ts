import { EventCategory } from "./types";

/**
 * One hue per category, used for the card kicker, the filter dot and the map
 * pin. This is a functional data-encoding system, not a second brand accent:
 * marigold stays the only brand color, these only ever distinguish categories
 * from one another.
 *
 * Lightness is fixed at 0.80 so every category clears 4.5:1 on --ink-900 and
 * --ink-850 regardless of hue.
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
  food: 42,
  family: 62,
  community: 22,
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

export function getCategoryColor(category: EventCategory): CategoryColor {
  const hue = HUE[category] ?? HUE.other;
  const chroma = category === "other" ? 0.04 : 0.14;
  return {
    color: `oklch(0.80 ${chroma} ${hue})`,
    wash: `oklch(0.80 ${chroma} ${hue} / 0.14)`,
    halo: `oklch(0.80 ${chroma} ${hue} / 0.18)`,
  };
}
