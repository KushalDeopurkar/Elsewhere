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
