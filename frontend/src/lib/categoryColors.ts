import { EventCategory } from "./types";

/**
 * Per-category hue assignments so category badges and card accent strips
 * read as genuinely different colors, not a single repeated blue.
 * Lightness/chroma are tuned to sit alongside the brand tokens in
 * globals.css (light tint background, saturated mid-tone accent,
 * darker readable text) and hold ~4.5:1+ contrast on their own tint.
 */
const CATEGORY_HUES: Record<EventCategory, number> = {
  music: 300,
  tech: 235,
  sports: 145,
  arts: 340,
  food: 45,
  business: 255,
  health: 175,
  education: 275,
  community: 25,
  nightlife: 315,
  family: 60,
  outdoor: 125,
  other: 195,
};

export interface CategoryColor {
  bg: string;
  text: string;
  accent: string;
}

export function getCategoryColor(category: EventCategory): CategoryColor {
  const hue = CATEGORY_HUES[category] ?? 195;
  const chroma = category === "other" ? 0.01 : 0.1;
  return {
    bg: `oklch(0.94 ${chroma === 0.01 ? 0.005 : 0.045} ${hue})`,
    text: `oklch(0.38 ${chroma === 0.01 ? 0.01 : 0.11} ${hue})`,
    accent: `oklch(0.62 ${chroma === 0.01 ? 0.01 : 0.13} ${hue})`,
  };
}
