import { EventCategory } from "./types";

/**
 * Presentation taxonomy.
 *
 * The database has a fixed 13-value `event_category` enum. Users think in
 * richer terms than that ("hackathons", "volunteering", "fashion"), so this
 * layer presents a broader taxonomy and resolves every entry to parameters
 * the search API genuinely supports: a real enum `category`, optionally
 * narrowed by a real full-text `q` against the Postgres tsvector index.
 *
 * Nothing here invents a filter the backend cannot honour. Where two
 * presented groups share one enum value, they are differentiated by keyword
 * so they never return identical result sets.
 *
 * Keywords are single terms on purpose: `plainto_tsquery` ANDs every word it
 * is given, so "AI machine learning" would require all three stems in one
 * event. One strong stem matches the way users expect.
 */
export interface TaxonomyQuery {
  category?: EventCategory;
  q?: string;
}

export interface Subcategory {
  slug: string;
  label: string;
  query: TaxonomyQuery;
}

export interface TaxonomyGroup {
  slug: string;
  label: string;
  /** Shown in the category explorer — says what belongs here. */
  blurb: string;
  query: TaxonomyQuery;
  /** Drives the category's accent; see categoryColors.ts. */
  category: EventCategory;
  subcategories: Subcategory[];
}

function sub(slug: string, label: string, query: TaxonomyQuery): Subcategory {
  return { slug, label, query };
}

export const TAXONOMY: TaxonomyGroup[] = [
  {
    slug: "technology",
    label: "Technology & AI",
    blurb: "Hackathons, AI, developer conferences and hardware",
    query: { category: "tech" },
    category: "tech",
    subcategories: [
      sub("hackathon", "Hackathons", { category: "tech", q: "hackathon" }),
      sub("ai", "AI & ML", { category: "tech", q: "ai" }),
      sub("conference", "Conferences", { category: "tech", q: "conference" }),
      sub("meetup", "Meetups", { category: "tech", q: "meetup" }),
      sub("robotics", "Robotics", { category: "tech", q: "robotics" }),
      sub("opensource", "Open source", { category: "tech", q: "open source" }),
    ],
  },
  {
    slug: "education",
    label: "Education & Learning",
    blurb: "Workshops, lectures, bootcamps and seminars",
    query: { category: "education" },
    category: "education",
    subcategories: [
      sub("workshop", "Workshops", { category: "education", q: "workshop" }),
      sub("seminar", "Seminars", { category: "education", q: "seminar" }),
      sub("webinar", "Webinars", { category: "education", q: "webinar" }),
      sub("lecture", "Lectures", { category: "education", q: "lecture" }),
      sub("bootcamp", "Bootcamps", { category: "education", q: "bootcamp" }),
    ],
  },
  {
    slug: "business",
    label: "Startups & Business",
    blurb: "Founders, pitches, investors and career fairs",
    query: { category: "business" },
    category: "business",
    subcategories: [
      sub("startup", "Startups", { category: "business", q: "startup" }),
      sub("pitch", "Pitch events", { category: "business", q: "pitch" }),
      sub("founder", "Founder meetups", { category: "business", q: "founder" }),
      sub("networking", "Networking", { category: "business", q: "networking" }),
      sub("career", "Career fairs", { category: "business", q: "career" }),
    ],
  },
  {
    slug: "arts",
    label: "Arts & Culture",
    blurb: "Exhibitions, theatre, film, poetry and literature",
    query: { category: "arts" },
    category: "arts",
    subcategories: [
      sub("exhibition", "Exhibitions", { category: "arts", q: "exhibition" }),
      sub("theatre", "Theatre", { category: "arts", q: "theatre" }),
      sub("film", "Film", { category: "arts", q: "film" }),
      sub("poetry", "Poetry", { category: "arts", q: "poetry" }),
      sub("photography", "Photography", { category: "arts", q: "photography" }),
    ],
  },
  {
    slug: "music",
    label: "Music",
    blurb: "Concerts, festivals and live performance",
    query: { category: "music" },
    category: "music",
    subcategories: [
      sub("concert", "Concerts", { category: "music", q: "concert" }),
      sub("festival", "Festivals", { category: "music", q: "festival" }),
      sub("live", "Live sets", { category: "music", q: "live" }),
    ],
  },
  {
    slug: "sports",
    label: "Sports & Fitness",
    blurb: "Matches, tournaments, running and fitness",
    query: { category: "sports" },
    category: "sports",
    subcategories: [
      sub("match", "Matches", { category: "sports", q: "match" }),
      sub("marathon", "Running", { category: "sports", q: "marathon" }),
      sub("tournament", "Tournaments", { category: "sports", q: "tournament" }),
      sub("fitness", "Fitness classes", { category: "sports", q: "fitness" }),
      sub("esports", "Esports", { category: "sports", q: "esports" }),
    ],
  },
  {
    slug: "community",
    label: "Community & Social",
    blurb: "Meetups, clubs, games and language exchanges",
    query: { category: "community" },
    category: "community",
    subcategories: [
      sub("meetup", "Meetups", { category: "community", q: "meetup" }),
      sub("games", "Games", { category: "community", q: "games" }),
      sub("language", "Language exchange", { category: "community", q: "language" }),
      sub("club", "Clubs", { category: "community", q: "club" }),
    ],
  },
  {
    slug: "food",
    label: "Food & Drink",
    blurb: "Tastings, food festivals and cooking classes",
    query: { category: "food" },
    category: "food",
    subcategories: [
      sub("tasting", "Tastings", { category: "food", q: "tasting" }),
      sub("cooking", "Cooking classes", { category: "food", q: "cooking" }),
      sub("festival", "Food festivals", { category: "food", q: "festival" }),
    ],
  },
  {
    slug: "wellbeing",
    label: "Lifestyle & Wellbeing",
    blurb: "Yoga, meditation and personal development",
    query: { category: "health" },
    category: "health",
    subcategories: [
      sub("yoga", "Yoga", { category: "health", q: "yoga" }),
      sub("meditation", "Meditation", { category: "health", q: "meditation" }),
      sub("wellness", "Wellness", { category: "health", q: "wellness" }),
    ],
  },
  {
    slug: "outdoors",
    label: "Travel & Outdoors",
    blurb: "Hikes, walks, camping and adventure",
    query: { category: "outdoor" },
    category: "outdoor",
    subcategories: [
      sub("hiking", "Hiking", { category: "outdoor", q: "hiking" }),
      sub("walk", "Guided walks", { category: "outdoor", q: "walk" }),
      sub("camping", "Camping", { category: "outdoor", q: "camping" }),
      sub("adventure", "Adventure", { category: "outdoor", q: "adventure" }),
    ],
  },
  {
    slug: "family",
    label: "Family & Kids",
    blurb: "Activities and workshops for children and families",
    query: { category: "family" },
    category: "family",
    subcategories: [
      sub("kids", "For kids", { category: "family", q: "kids" }),
      sub("workshop", "Kids' workshops", { category: "family", q: "workshop" }),
    ],
  },
  {
    slug: "nightlife",
    label: "Nightlife",
    blurb: "Club nights, DJs and late programming",
    query: { category: "nightlife" },
    category: "nightlife",
    subcategories: [
      sub("dj", "DJ nights", { category: "nightlife", q: "dj" }),
      sub("party", "Parties", { category: "nightlife", q: "party" }),
    ],
  },
  // The remaining groups share an enum value with a group above, so each is
  // narrowed by keyword — they return genuinely different results, never a
  // duplicate of their parent category.
  {
    slug: "impact",
    label: "Social Impact",
    blurb: "Volunteering, charity and environmental action",
    query: { category: "community", q: "volunteer" },
    category: "community",
    subcategories: [
      sub("volunteer", "Volunteering", { category: "community", q: "volunteer" }),
      sub("charity", "Charity", { category: "community", q: "charity" }),
      sub("environment", "Environment", { category: "community", q: "environment" }),
    ],
  },
  {
    slug: "civic",
    label: "Government & Civic",
    blurb: "Public lectures, consultations and civic meetings",
    query: { category: "community", q: "public" },
    category: "community",
    subcategories: [
      sub("public", "Public lectures", { category: "community", q: "public" }),
      sub("civic", "Civic meetings", { category: "community", q: "civic" }),
    ],
  },
  {
    slug: "design",
    label: "Fashion & Design",
    blurb: "Design exhibitions, fashion shows and studio sessions",
    query: { category: "arts", q: "design" },
    category: "arts",
    subcategories: [
      sub("design", "Design", { category: "arts", q: "design" }),
      sub("fashion", "Fashion", { category: "arts", q: "fashion" }),
    ],
  },
];

/** Groups surfaced on the homepage; the rest live behind "All categories". */
export const FEATURED_GROUP_SLUGS = [
  "technology",
  "music",
  "arts",
  "business",
  "sports",
  "food",
  "education",
  "community",
];

export function getGroup(slug: string): TaxonomyGroup | undefined {
  return TAXONOMY.find((g) => g.slug === slug);
}

export function getFeaturedGroups(): TaxonomyGroup[] {
  return FEATURED_GROUP_SLUGS.map(getGroup).filter(
    (g): g is TaxonomyGroup => g !== undefined
  );
}
