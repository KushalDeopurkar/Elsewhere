export interface Event {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  url: string | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;
  source: string;
  distance_km: number | null;
  relevance: number | null;
  /**
   * Delivery format. Not a database column yet, so rows from the API arrive
   * without it and are treated as in-person. Adding it needs a migration.
   */
  format?: EventFormat;
}

export type EventFormat = "in_person" | "online" | "hybrid";

export type EventCategory =
  | "music"
  | "tech"
  | "sports"
  | "arts"
  | "food"
  | "business"
  | "health"
  | "education"
  | "community"
  | "nightlife"
  | "family"
  | "outdoor"
  | "other";

/**
 * Presentation layer over the stored category enum.
 *
 * The database enum has 13 values and changing it needs a migration we cannot
 * run without Supabase access, so the stored values are unchanged and only
 * their labels widen to cover the full taxonomy. `blurb` names the kinds of
 * event each one holds, which is what makes the product read as universal
 * rather than as a nightlife app with categories bolted on.
 */
export const CATEGORIES: {
  value: EventCategory;
  label: string;
  blurb: string;
}[] = [
  { value: "tech", label: "Technology & AI", blurb: "Hackathons, AI, developer meetups" },
  { value: "business", label: "Startups & Business", blurb: "Pitches, founders, networking" },
  { value: "education", label: "Education & Learning", blurb: "Workshops, lectures, bootcamps" },
  { value: "arts", label: "Arts & Culture", blurb: "Exhibitions, theatre, film, poetry" },
  { value: "sports", label: "Sports & Fitness", blurb: "Matches, runs, tournaments, esports" },
  { value: "music", label: "Music", blurb: "Concerts, festivals, live sets" },
  { value: "community", label: "Community & Social", blurb: "Meetups, clubs, volunteering" },
  { value: "food", label: "Food & Drink", blurb: "Tastings, festivals, cooking" },
  { value: "health", label: "Lifestyle & Wellbeing", blurb: "Yoga, wellness, personal growth" },
  { value: "outdoor", label: "Travel & Outdoors", blurb: "Hikes, walks, adventure" },
  { value: "family", label: "Family & Kids", blurb: "Workshops and days out" },
  { value: "nightlife", label: "Nightlife", blurb: "Club nights and late sets" },
  { value: "other", label: "Everything else", blurb: "Civic, fashion, and more" },
];

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  meta: { total?: number; limit?: number; offset?: number } | null;
}

export interface SearchParams {
  q?: string;
  category?: EventCategory;
  lat?: number;
  lng?: number;
  radius_km?: number;
  limit?: number;
  offset?: number;
}
