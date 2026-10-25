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
  is_online: boolean;
  source: string;
  distance_km: number | null;
  relevance: number | null;
}

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

export const CATEGORIES: { value: EventCategory; label: string; emoji: string }[] = [
  { value: "music", label: "Music", emoji: "🎵" },
  { value: "tech", label: "Tech", emoji: "💻" },
  { value: "sports", label: "Sports", emoji: "⚽" },
  { value: "arts", label: "Arts", emoji: "🎨" },
  { value: "food", label: "Food", emoji: "🍕" },
  { value: "business", label: "Business", emoji: "💼" },
  { value: "health", label: "Health", emoji: "🏥" },
  { value: "education", label: "Education", emoji: "📚" },
  { value: "community", label: "Community", emoji: "🏘️" },
  { value: "nightlife", label: "Nightlife", emoji: "🌙" },
  { value: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { value: "outdoor", label: "Outdoor", emoji: "🌲" },
  { value: "other", label: "Other", emoji: "📌" },
];

/**
 * Human labels for the raw enum values. The enum is terse because it is a
 * storage detail; these are what a reader should see.
 */
export const CATEGORY_LABELS: Record<EventCategory, string> = {
  music: "Music",
  tech: "Technology",
  sports: "Sports",
  arts: "Arts & Culture",
  food: "Food & Drink",
  business: "Business",
  health: "Wellbeing",
  education: "Education",
  community: "Community",
  nightlife: "Nightlife",
  family: "Family",
  outdoor: "Outdoors",
  other: "Other",
};

export function categoryLabel(category: EventCategory): string {
  return CATEGORY_LABELS[category] ?? "Other";
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  meta: { total?: number; limit?: number; offset?: number } | null;
}

export type EventSort = "relevance" | "date" | "distance";

export interface SearchParams {
  q?: string;
  category?: EventCategory;
  lat?: number;
  lng?: number;
  radius_km?: number;
  /** ISO timestamps; the API defaults from_time to "now" when omitted. */
  from_time?: string;
  to_time?: string;
  /** Tri-state on the wire: omitted means "no constraint". */
  free_only?: boolean;
  online_only?: boolean;
  sort_by?: EventSort;
  limit?: number;
  offset?: number;
}
