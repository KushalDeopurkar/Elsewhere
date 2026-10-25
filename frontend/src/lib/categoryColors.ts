import { EventCategory } from "./types";

/**
 * Per-category hues.
 *
 * Category colour is an index key, not a theme: it appears as a small marker,
 * a tile edge and the generated card art, never as a full restyling of the
 * interface. That is what lets a robotics listing and a poetry reading sit in
 * the same grid and still belong to one product.
 */
const CATEGORY_HUES: Record<EventCategory, number> = {
  tech: 245,
  education: 275,
  business: 295,
  arts: 340,
  music: 318,
  sports: 150,
  community: 30,
  food: 60,
  health: 180,
  outdoor: 130,
  family: 85,
  nightlife: 300,
  other: 230,
};

/** "other" is deliberately desaturated — an unknown category shouldn't shout. */
function chromaFor(category: EventCategory): number {
  return category === "other" ? 0.02 : 0.14;
}

export interface CategoryPaint {
  /** Solid marker colour — chip dots, map pins. */
  marker: string;
  /** Category tile edge rule. */
  tileAccent: string;
  /** Generated card art, as CSS custom properties. */
  art: {
    "--art-top": string;
    "--art-bottom": string;
    "--art-line": string;
    "--art-ink": string;
  };
}

/**
 * Values are built with `color-mix` against the theme's own surface and ink
 * tokens, so a single definition resolves correctly in light and dark without
 * shipping two palettes or reading the active theme in JS.
 */
export function getCategoryPaint(category: EventCategory): CategoryPaint {
  const hue = CATEGORY_HUES[category] ?? CATEGORY_HUES.other;
  const c = chromaFor(category);
  const base = `oklch(0.62 ${c} ${hue})`;

  return {
    marker: base,
    tileAccent: base,
    art: {
      "--art-top": `color-mix(in oklab, ${base} 22%, var(--paper-raised))`,
      "--art-bottom": `color-mix(in oklab, ${base} 7%, var(--paper-raised))`,
      "--art-line": `color-mix(in oklab, ${base} 22%, transparent)`,
      "--art-ink": `color-mix(in oklab, ${base} 58%, var(--ink))`,
    },
  };
}
