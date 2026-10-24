import { Event, EventCategory } from "./types";

/**
 * Sample events used when the API cannot be reached.
 *
 * The ingestion pipeline needs a Supabase project and network access to the
 * scrape targets, neither of which exists in a fresh checkout. Rather than
 * showing an empty grid, the app falls back to this set and labels it in the
 * UI as sample data, so what you see is never mistaken for live listings.
 *
 * Start times are derived from the start of the current day in IST plus a
 * fixed offset, so the set always looks upcoming and both the server and the
 * browser compute identical values.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function startOfTodayIST(): number {
  const nowIST = Date.now() + IST_OFFSET_MS;
  return Math.floor(nowIST / 86_400_000) * 86_400_000 - IST_OFFSET_MS;
}

/** An ISO instant at `days` from today, at `hour`:00 IST. */
function at(days: number, hour: number): string {
  return new Date(
    startOfTodayIST() + days * 86_400_000 + hour * 3_600_000,
  ).toISOString();
}

interface Seed {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  days: number;
  hour: number;
  hours: number;
  venue: string;
  area: string;
  city: string;
  lat: number;
  lng: number;
  free?: boolean;
  min?: number;
  max?: number;
}

const SEEDS: Seed[] = [
  {
    id: "d1a7f2c0-0001-4a10-9c21-5f3e9b0a1101",
    title: "Basement Tapes: Peter Cat Recording Co.",
    description:
      "The Delhi six-piece bring their lounge-jazz and psych set to the harbour warehouse, with a support slot from Bombay Bandook and a late DJ session on the terrace until 2am.",
    category: "music",
    days: 0,
    hour: 21,
    hours: 4,
    venue: "Famous Studios",
    area: "Mahalaxmi",
    city: "Mumbai",
    lat: 18.9894,
    lng: 72.8231,
    min: 1200,
    max: 2800,
  },
  {
    id: "d1a7f2c0-0002-4a10-9c21-5f3e9b0a1102",
    title: "Open Mic Night at Cuckoo Club",
    description:
      "Eight minutes a slot, no hecklers, no phones. Sign-ups open at 7pm at the door and the list closes once twelve names are down.",
    category: "arts",
    days: 0,
    hour: 20,
    hours: 3,
    venue: "The Cuckoo Club",
    area: "Bandra West",
    city: "Mumbai",
    lat: 19.0662,
    lng: 72.8309,
    min: 300,
  },
  {
    id: "d1a7f2c0-0003-4a10-9c21-5f3e9b0a1103",
    title: "Sunday Long Run: Cubbon Park Loop",
    description:
      "A 12km social run at a 6:30 per kilometre pace, looping Cubbon Park and the Vidhana Soudha stretch. Bag drop and filter coffee at the bandstand afterwards.",
    category: "sports",
    days: 1,
    hour: 6,
    hours: 2,
    venue: "Cubbon Park Bandstand",
    area: "Sampangi Rama Nagar",
    city: "Bengaluru",
    lat: 12.9763,
    lng: 77.5929,
    free: true,
  },
  {
    id: "d1a7f2c0-0004-4a10-9c21-5f3e9b0a1104",
    title: "Kombucha and Ferments Workshop",
    description:
      "Build a SCOBY from scratch, bottle two flavours, and take home a starter culture. Covers second fermentation, carbonation and what to do when a batch goes wrong.",
    category: "food",
    days: 2,
    hour: 11,
    hours: 3,
    venue: "The Pantry",
    area: "Fort",
    city: "Mumbai",
    lat: 18.9322,
    lng: 72.8328,
    min: 2400,
  },
  {
    id: "d1a7f2c0-0005-4a10-9c21-5f3e9b0a1105",
    title: "Bangalore Rust Meetup: Async Internals",
    description:
      "Two talks on the Tokio scheduler and on writing a custom executor, followed by lightning slots. Laptops welcome, pizza from 7pm.",
    category: "tech",
    days: 2,
    hour: 18,
    hours: 3,
    venue: "91springboard Koramangala",
    area: "Koramangala",
    city: "Bengaluru",
    lat: 12.9345,
    lng: 77.6266,
    free: true,
  },
  {
    id: "d1a7f2c0-0006-4a10-9c21-5f3e9b0a1106",
    title: "Nehru Park Morning Raga",
    description:
      "An open-air Hindustani classical recital at sunrise, part of the winter season. Carpets provided, chai from the stall by the east gate.",
    category: "music",
    days: 3,
    hour: 7,
    hours: 2,
    venue: "Nehru Park",
    area: "Chanakyapuri",
    city: "Delhi",
    lat: 28.5906,
    lng: 77.1901,
    free: true,
  },
  {
    id: "d1a7f2c0-0007-4a10-9c21-5f3e9b0a1107",
    title: "Kala Ghoda Print Fair",
    description:
      "Forty independent printmakers, risograph studios and zine publishers across the courtyard and the colonnade. Live screen-printing on anything you bring.",
    category: "arts",
    days: 3,
    hour: 11,
    hours: 8,
    venue: "Rampart Row",
    area: "Kala Ghoda",
    city: "Mumbai",
    lat: 18.9281,
    lng: 72.8319,
    free: true,
  },
  {
    id: "d1a7f2c0-0008-4a10-9c21-5f3e9b0a1108",
    title: "Terrace Sessions: Deep House till Late",
    description:
      "A rooftop set from Kohra and Zokhuma with the city skyline behind the booth. Entry is capped at 200 and the guest list shuts at midnight.",
    category: "nightlife",
    days: 4,
    hour: 22,
    hours: 5,
    venue: "Antisocial",
    area: "Khar West",
    city: "Mumbai",
    lat: 19.0707,
    lng: 72.8367,
    min: 999,
    max: 1800,
  },
  {
    id: "d1a7f2c0-0009-4a10-9c21-5f3e9b0a1109",
    title: "Saturday Farmers Market",
    description:
      "Hill produce, sourdough, cold-pressed oils and about a dozen small growers from the Nilgiris. Bring your own bags, cash preferred at most stalls.",
    category: "food",
    days: 4,
    hour: 8,
    hours: 5,
    venue: "Jayamahal Palace Grounds",
    area: "Jayamahal",
    city: "Bengaluru",
    lat: 13.0063,
    lng: 77.5945,
    free: true,
  },
  {
    id: "d1a7f2c0-0010-4a10-9c21-5f3e9b0a1110",
    title: "Standup: Work in Progress",
    description:
      "Four comics testing unfinished material on a room that knows it. Nothing is recorded, and the sets change every week.",
    category: "arts",
    days: 5,
    hour: 20,
    hours: 2,
    venue: "Habitat",
    area: "Khar West",
    city: "Mumbai",
    lat: 19.0728,
    lng: 72.8347,
    min: 499,
  },
  {
    id: "d1a7f2c0-0011-4a10-9c21-5f3e9b0a1111",
    title: "Night Trek to Rajmachi Fort",
    description:
      "A 15km moonlight trek from Udhewadi, starting at midnight and reaching the fort for sunrise. Transport from Dadar included, moderate fitness needed.",
    category: "outdoor",
    days: 5,
    hour: 23,
    hours: 9,
    venue: "Departure: Dadar East",
    area: "Dadar",
    city: "Mumbai",
    lat: 19.0178,
    lng: 72.8478,
    min: 1650,
  },
  {
    id: "d1a7f2c0-0012-4a10-9c21-5f3e9b0a1112",
    title: "Founders Breakfast: Raising a Seed Round",
    description:
      "A closed-room conversation with three founders who closed rounds this year, on what the deck actually needed and which metrics got asked about.",
    category: "business",
    days: 6,
    hour: 9,
    hours: 2,
    venue: "Social Offline",
    area: "Hauz Khas Village",
    city: "Delhi",
    lat: 28.5542,
    lng: 77.1944,
    min: 750,
  },
  {
    id: "d1a7f2c0-0013-4a10-9c21-5f3e9b0a1113",
    title: "Vinyasa in the Park",
    description:
      "A 75-minute flow on the lawn, suitable for anyone who can hold a plank for thirty seconds. Mats available to borrow, limited to forty people.",
    category: "health",
    days: 6,
    hour: 7,
    hours: 2,
    venue: "Shivaji Park",
    area: "Dadar West",
    city: "Mumbai",
    lat: 19.0283,
    lng: 72.8397,
    min: 400,
  },
  {
    id: "d1a7f2c0-0014-4a10-9c21-5f3e9b0a1114",
    title: "Lodhi Art District Walk",
    description:
      "A two-hour guided walk across India's first public art district, covering twenty-five murals and the artists behind them. Ends at the Meharchand market.",
    category: "community",
    days: 7,
    hour: 16,
    hours: 2,
    venue: "Lodhi Colony",
    area: "Lodhi Colony",
    city: "Delhi",
    lat: 28.5833,
    lng: 77.2256,
    min: 600,
  },
];

function build(seed: Seed): Event {
  return {
    id: seed.id,
    title: seed.title,
    description: seed.description,
    category: seed.category,
    start_time: at(seed.days, seed.hour),
    end_time: at(seed.days, seed.hour + seed.hours),
    location_name: seed.venue,
    address: `${seed.area}, ${seed.city}`,
    city: seed.city,
    country: "IN",
    lat: seed.lat,
    lng: seed.lng,
    image_url: `https://picsum.photos/seed/${seed.id.slice(9, 13)}-${seed.category}/960/720`,
    url: null,
    price_min: seed.min ?? null,
    price_max: seed.max ?? null,
    is_free: seed.free ?? false,
    source: "sample",
    distance_km: null,
    relevance: null,
  };
}

export const DEMO_EVENTS: Event[] = SEEDS.map(build).sort(
  (a, b) => Date.parse(a.start_time) - Date.parse(b.start_time),
);

export const DEMO_CITIES = ["Mumbai", "Bengaluru", "Delhi"] as const;
