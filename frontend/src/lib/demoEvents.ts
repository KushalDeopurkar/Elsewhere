import { Event, EventCategory, EventFormat } from "./types";

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
  format?: EventFormat;
  free?: boolean;
  min?: number;
  max?: number;
}

const SEEDS: Seed[] = [
  {
    id: "d1a7f2c0-0001-4a10-9c21-5f3e9b0a1101",
    title: "BuildAI Mumbai: 24-Hour AI Hackathon",
    description:
      "A full day of building with open models. Teams of up to four, mentors from local AI teams on the floor all night, and demos judged at 6pm on Sunday. Beginners welcome, hardware and credits provided.",
    category: "tech", days: 1, hour: 9, hours: 24,
    venue: "IIT Bombay Startup Hub", area: "Powai", city: "Mumbai",
    lat: 19.1334, lng: 72.9133, free: true,
  },
  {
    id: "d1a7f2c0-0002-4a10-9c21-5f3e9b0a1102",
    title: "Fine-Tuning Small Language Models",
    description:
      "A hands-on workshop covering LoRA, dataset preparation and evaluation. Bring a laptop; GPUs are provided in the cloud for the session.",
    category: "education", days: 1, hour: 14, hours: 4,
    venue: "Online", area: "Online", city: "Online",
    lat: 19.076, lng: 72.8777, format: "online", min: 499,
  },
  {
    id: "d1a7f2c0-0003-4a10-9c21-5f3e9b0a1103",
    title: "Seed Stage: Founder Pitch Night",
    description:
      "Eight founders pitch to a panel of early-stage investors, six minutes each with live feedback. Open to anyone building, not just those pitching.",
    category: "business", days: 7, hour: 18, hours: 3,
    venue: "91springboard Koramangala", area: "Koramangala", city: "Bengaluru",
    lat: 12.9345, lng: 77.6266, free: true,
  },
  {
    id: "d1a7f2c0-0004-4a10-9c21-5f3e9b0a1104",
    title: "Bangalore Rust Meetup: Async Internals",
    description:
      "Two talks on the Tokio scheduler and writing a custom executor, then lightning slots. Laptops welcome, pizza from 7pm.",
    category: "tech", days: 4, hour: 18, hours: 3,
    venue: "Thoughtworks Bengaluru", area: "Koramangala", city: "Bengaluru",
    lat: 12.9352, lng: 77.6245, free: true,
  },
  {
    id: "d1a7f2c0-0005-4a10-9c21-5f3e9b0a1105",
    title: "Intro to Product Design: Beginner Workshop",
    description:
      "A practical first session on wireframing, user flows and critique. No design background needed, and every exercise is done in the room.",
    category: "education", days: 5, hour: 10, hours: 6,
    venue: "Bombay Design Centre", area: "Lower Parel", city: "Mumbai",
    lat: 18.9960, lng: 72.8258, min: 1200,
  },
  {
    id: "d1a7f2c0-0006-4a10-9c21-5f3e9b0a1106",
    title: "Robotics Open Day and Line-Follower Contest",
    description:
      "Student teams race line-following robots, with workshops on sensors and motor control running alongside. Spectators free, entry fee covers a team kit.",
    category: "tech", days: 7, hour: 10, hours: 7,
    venue: "Delhi Technological University", area: "Rohini", city: "Delhi",
    lat: 28.7501, lng: 77.1177, free: true,
  },
  {
    id: "d1a7f2c0-0007-4a10-9c21-5f3e9b0a1107",
    title: "Machine Learning Conference: Applied Track",
    description:
      "A full-day online conference on deploying models in production, with talks on evaluation, drift and serving. Recordings available to ticket holders.",
    category: "tech", days: 7, hour: 13, hours: 6,
    venue: "Online", area: "Online", city: "Online",
    lat: 12.9716, lng: 77.5946, format: "online", min: 999,
  },
  {
    id: "d1a7f2c0-0008-4a10-9c21-5f3e9b0a1108",
    title: "Kala Ghoda Print Fair",
    description:
      "Forty independent printmakers, risograph studios and zine publishers across the courtyard. Live screen-printing on anything you bring.",
    category: "arts", days: 3, hour: 11, hours: 8,
    venue: "Rampart Row", area: "Kala Ghoda", city: "Mumbai",
    lat: 18.9281, lng: 72.8319, free: true,
  },
  {
    id: "d1a7f2c0-0009-4a10-9c21-5f3e9b0a1109",
    title: "Poetry at the Pier: Open Readings",
    description:
      "An open-floor reading night. Five minutes a reader, sign up at the door, and the room listens properly.",
    category: "arts", days: 1, hour: 19, hours: 3,
    venue: "Harbour Bar", area: "Colaba", city: "Mumbai",
    lat: 18.9220, lng: 72.8332, min: 300,
  },
  {
    id: "d1a7f2c0-0010-4a10-9c21-5f3e9b0a1110",
    title: "Mumbai City FC vs Bengaluru FC",
    description:
      "Indian Super League fixture at the Football Arena. Gates open two hours before kickoff, away section at the north end.",
    category: "sports", days: 5, hour: 19, hours: 3,
    venue: "Mumbai Football Arena", area: "Andheri West", city: "Mumbai",
    lat: 19.1334, lng: 72.8267, min: 300, max: 2500,
  },
  {
    id: "d1a7f2c0-0011-4a10-9c21-5f3e9b0a1111",
    title: "Sunday Long Run: Cubbon Park Loop",
    description:
      "A 12km social run at a 6:30 per kilometre pace. Bag drop and filter coffee at the bandstand afterwards.",
    category: "sports", days: 4, hour: 6, hours: 2,
    venue: "Cubbon Park Bandstand", area: "Sampangi Rama Nagar", city: "Bengaluru",
    lat: 12.9763, lng: 77.5929, free: true,
  },
  {
    id: "d1a7f2c0-0012-4a10-9c21-5f3e9b0a1112",
    title: "Weekend Volunteer Drive: Versova Beach Clean-Up",
    description:
      "A three-hour shoreline clean-up with gloves, bags and sorting provided. Groups and families welcome, no sign-up needed.",
    category: "community", days: 1, hour: 7, hours: 3,
    venue: "Versova Beach", area: "Andheri West", city: "Mumbai",
    lat: 19.1340, lng: 72.8129, free: true,
  },
  {
    id: "d1a7f2c0-0013-4a10-9c21-5f3e9b0a1113",
    title: "Board Game Night: Strategy and Snacks",
    description:
      "Thirty titles on the shelf from light fillers to four-hour campaigns. Come alone and you will be seated at a table.",
    category: "community", days: 0, hour: 18, hours: 5,
    venue: "Dice and Dine", area: "Indiranagar", city: "Bengaluru",
    lat: 12.9784, lng: 77.6408, min: 350,
  },
  {
    id: "d1a7f2c0-0014-4a10-9c21-5f3e9b0a1114",
    title: "Kombucha and Ferments Workshop",
    description:
      "Build a SCOBY from scratch, bottle two flavours and take home a starter culture. Covers second fermentation and what to do when a batch fails.",
    category: "food", days: 4, hour: 11, hours: 3,
    venue: "The Pantry", area: "Fort", city: "Mumbai",
    lat: 18.9322, lng: 72.8328, min: 2400,
  },
  {
    id: "d1a7f2c0-0015-4a10-9c21-5f3e9b0a1115",
    title: "Vinyasa in the Park",
    description:
      "A 75-minute flow on the lawn, suitable for anyone who can hold a plank for thirty seconds. Mats available to borrow.",
    category: "health", days: 1, hour: 7, hours: 2,
    venue: "Shivaji Park", area: "Dadar West", city: "Mumbai",
    lat: 19.0283, lng: 72.8397, min: 400,
  },
  {
    id: "d1a7f2c0-0016-4a10-9c21-5f3e9b0a1116",
    title: "Night Trek to Rajmachi Fort",
    description:
      "A 15km moonlight trek from Udhewadi, starting at midnight and reaching the fort for sunrise. Transport from Dadar included.",
    category: "outdoor", days: 5, hour: 23, hours: 9,
    venue: "Departure: Dadar East", area: "Dadar", city: "Mumbai",
    lat: 19.0178, lng: 72.8478, min: 1650,
  },
  {
    id: "d1a7f2c0-0017-4a10-9c21-5f3e9b0a1117",
    title: "Little Engineers: Family Build Lab",
    description:
      "A drop-in session where children aged six to twelve build simple machines with an adult. Materials included, sessions run on the hour.",
    category: "family", days: 6, hour: 10, hours: 5,
    venue: "Nehru Science Centre", area: "Worli", city: "Mumbai",
    lat: 19.0012, lng: 72.8294, min: 250,
  },
  {
    id: "d1a7f2c0-0018-4a10-9c21-5f3e9b0a1118",
    title: "Basement Tapes: Live Session",
    description:
      "A lounge-jazz and psych set in the harbour warehouse, with a support slot and a late DJ session on the terrace.",
    category: "music", days: 0, hour: 21, hours: 4,
    venue: "Famous Studios", area: "Mahalaxmi", city: "Mumbai",
    lat: 18.9894, lng: 72.8231, min: 1200, max: 2800,
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
    format: seed.format ?? "in_person",
    source: "sample",
    distance_km: null,
    relevance: null,
  };
}

export const DEMO_EVENTS: Event[] = SEEDS.map(build).sort(
  (a, b) => Date.parse(a.start_time) - Date.parse(b.start_time),
);

export const DEMO_CITIES = ["Mumbai", "Bengaluru", "Delhi", "Online"] as const;
