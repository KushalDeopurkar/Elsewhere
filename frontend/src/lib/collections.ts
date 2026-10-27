import { SearchParams } from "./types";

/**
 * Curated collections.
 *
 * An editorial layer over the index: each collection is a hand-written angle
 * ("Learn something new", "Out after dark") that resolves to a real query.
 * Nothing is hand-picked per event and nothing is fabricated — the title is
 * the editorial judgement, the contents are whatever the API returns.
 */
export interface Collection {
  slug: string;
  title: string;
  /** One line of why this collection exists. */
  blurb: string;
  /** Hue used for the collection card's wash. */
  hue: number;
  /** Discovery-state query string, so the card links into the real feed. */
  href: string;
  params: SearchParams;
}

export const COLLECTIONS: Collection[] = [
  {
    slug: "learn",
    title: "Learn something new",
    blurb: "Workshops, lectures and bootcamps",
    hue: 275,
    href: "/?group=education",
    params: { category: "education", sort_by: "date", limit: 10 },
  },
  {
    slug: "build",
    title: "Build something this weekend",
    blurb: "Hackathons and open-source sprints",
    hue: 245,
    href: "/?group=technology&sub=hackathon",
    params: { category: "tech", q: "hackathon", sort_by: "date", limit: 10 },
  },
  {
    slug: "culture",
    title: "A night at the gallery",
    blurb: "Exhibitions, theatre and film",
    hue: 340,
    href: "/?group=arts",
    params: { category: "arts", sort_by: "date", limit: 10 },
  },
  {
    slug: "outdoors",
    title: "Get outside",
    blurb: "Hikes, walks and open-air adventure",
    hue: 130,
    href: "/?group=outdoors",
    params: { category: "outdoor", sort_by: "date", limit: 10 },
  },
  {
    slug: "table",
    title: "Pull up a chair",
    blurb: "Tastings, supper clubs and food festivals",
    hue: 60,
    href: "/?group=food",
    params: { category: "food", sort_by: "date", limit: 10 },
  },
  {
    slug: "dark",
    title: "Out after dark",
    blurb: "Club nights, live sets and late programming",
    hue: 300,
    href: "/?group=nightlife",
    params: { category: "nightlife", sort_by: "date", limit: 10 },
  },
];
