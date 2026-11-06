import { CATEGORIES, EventCategory } from "./types";

/**
 * Public category pages. Slugs are readable words; each maps to one stored
 * category value (the database enum has 13). Hackathons, startups and
 * volunteering are covered by Technology, Business and Community.
 */
export interface CategoryPage {
  slug: string;
  value: EventCategory;
  label: string;
  blurb: string;
}

const SLUGS: Record<EventCategory, string> = {
  tech: "technology",
  business: "business",
  education: "education",
  arts: "arts",
  sports: "sports",
  music: "music",
  community: "community",
  food: "food",
  health: "wellness",
  outdoor: "outdoors",
  family: "family",
  nightlife: "nightlife",
  other: "more",
};

export const CATEGORY_PAGES: CategoryPage[] = CATEGORIES.map((c) => ({
  slug: SLUGS[c.value],
  value: c.value,
  label: c.label,
  blurb: c.blurb,
}));

export function categoryBySlug(slug: string): CategoryPage | null {
  return CATEGORY_PAGES.find((c) => c.slug === slug) ?? null;
}

export function categoryHref(value: EventCategory): string {
  return `/categories/${SLUGS[value]}`;
}
