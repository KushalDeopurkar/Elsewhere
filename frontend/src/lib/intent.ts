import { Event, EventCategory, EventFormat } from "./types";
import { matchesWindow } from "./formatDate";

/**
 * Intent parsing for natural-language discovery.
 *
 * This is deterministic keyword and phrase matching, not a language model.
 * The backend offers Postgres full-text search over one category at a time
 * and nothing else: no embeddings, no semantic index, no LLM. Rather than
 * implying an intelligence the stack does not have, this decomposes a query
 * into the dimensions the data genuinely supports (interest, goal, date,
 * place, budget, format), runs real queries for each, and shows the user
 * exactly which signals it read. Every signal is removable, so a wrong guess
 * costs one click instead of a retyped query.
 *
 * Dimensions the schema cannot support yet are detected and reported as
 * unsupported rather than silently ignored: experience level and tags have no
 * column, and `format` exists only on sample rows.
 */

export type Goal = "learn" | "meet" | "build" | "move" | "unwind" | "create" | "give";
export type When = "any" | "today" | "tomorrow" | "weekend";

export interface Signal {
  kind: "interest" | "goal" | "when" | "where" | "budget" | "format";
  /** Machine value, e.g. an EventCategory or a When. */
  value: string;
  /** What the chip shows. */
  label: string;
  /** The words in the query that produced it. */
  source: string;
}

export interface Intent {
  text: string;
  signals: Signal[];
  interests: EventCategory[];
  goals: Goal[];
  when: When;
  city: string | null;
  freeOnly: boolean;
  format: EventFormat | null;
  /** Dimensions the user asked for that the data cannot answer. */
  unsupported: string[];
}

const INTEREST_WORDS: Record<EventCategory, string[]> = {
  tech: ["ai", "artificial intelligence", "machine learning", "ml", "hackathon", "hack", "coding", "code", "developer", "dev", "programming", "robotics", "tech", "technology", "software", "data", "open source", "engineer"],
  business: ["startup", "founder", "entrepreneur", "investor", "pitch", "networking", "network", "business", "career", "vc", "funding"],
  education: ["workshop", "course", "bootcamp", "lecture", "seminar", "class", "training", "webinar", "masterclass"],
  arts: ["art", "exhibition", "gallery", "theatre", "theater", "poetry", "film", "cinema", "photography", "design", "museum", "literature", "book", "culture", "creative"],
  sports: ["sport", "football", "cricket", "match", "marathon", "run", "running", "tournament", "fitness", "gym", "esports", "game day", "cycling"],
  music: ["music", "concert", "gig", "band", "festival", "live", "dj", "singer"],
  community: ["community", "meetup", "social", "volunteer", "volunteering", "charity", "board game", "club", "language exchange", "meet people", "friends"],
  food: ["food", "cooking", "tasting", "culinary", "restaurant", "dinner", "brunch", "coffee", "baking", "drink"],
  health: ["yoga", "wellness", "meditation", "wellbeing", "mindfulness", "health", "mental health", "therapy"],
  outdoor: ["outdoor", "outdoors", "hike", "hiking", "trek", "trekking", "camping", "nature", "walk", "adventure", "cycling"],
  family: ["family", "kids", "children", "child", "toddler", "parent"],
  nightlife: ["nightlife", "club", "clubbing", "party", "late night", "bar"],
  other: [],
};

const GOAL_WORDS: Record<Goal, string[]> = {
  learn: ["learn", "learning", "improve", "skill", "skills", "understand", "study", "beginner", "get better", "upskill"],
  meet: ["meet", "network", "networking", "people", "friends", "connect", "socialise", "socialize", "community"],
  build: ["build", "building", "make", "hack", "compete", "competition", "project", "ship", "create something"],
  move: ["active", "exercise", "fit", "fitness", "run", "sport", "outdoors", "train"],
  unwind: ["relax", "unwind", "chill", "bored", "fun", "something different", "enjoy", "calm"],
  create: ["create", "creative", "art", "design", "write", "paint", "draw", "perform"],
  give: ["volunteer", "give back", "charity", "help", "contribute", "social impact"],
};

/** Goals that widen the search beyond the interests named outright. */
const GOAL_CATEGORIES: Record<Goal, EventCategory[]> = {
  learn: ["education", "tech"],
  meet: ["community", "business", "tech"],
  build: ["tech", "education"],
  move: ["sports", "outdoor"],
  unwind: ["music", "food", "arts", "outdoor"],
  create: ["arts", "education"],
  give: ["community"],
};

const GOAL_LABEL: Record<Goal, string> = {
  learn: "Learn", meet: "Meet people", build: "Build", move: "Get active",
  unwind: "Unwind", create: "Create", give: "Give back",
};

const WHEN_WORDS: [When, string[]][] = [
  ["weekend", ["this weekend", "weekend", "saturday", "sunday"]],
  ["tomorrow", ["tomorrow"]],
  ["today", ["today", "tonight", "this evening", "right now"]],
];

const CITY_WORDS = ["mumbai", "bengaluru", "bangalore", "delhi", "online"];

const FREE_WORDS = ["free", "no cost", "zero cost", "affordable", "cheap", "budget", "no money"];
const ONLINE_WORDS = ["online", "remote", "virtual", "from home", "livestream"];
const IN_PERSON_WORDS = ["in person", "in-person", "nearby", "near me", "around me"];

/** Dimensions the schema has no column for. Detected so they can be said out loud. */
const UNSUPPORTED: [string, string[]][] = [
  ["experience level", ["beginner friendly", "beginner-friendly", "advanced", "intermediate", "student only", "for students"]],
  ["group size", ["solo", "with friends", "alone"]],
];

const ACRONYMS: Record<string, string> = {
  ai: "AI", ml: "ML", vc: "VC", dj: "DJ", "artificial intelligence": "AI",
  "machine learning": "Machine learning", "open source": "Open source",
};

const titleCase = (s: string) =>
  ACRONYMS[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1);

function findPhrase(haystack: string, needles: string[]): string | null {
  for (const n of needles) {
    const re = new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
    if (re.test(haystack)) return n;
  }
  return null;
}

export function parseIntent(raw: string): Intent {
  const text = raw.trim();
  const q = ` ${text.toLowerCase()} `;
  const signals: Signal[] = [];

  const interests: EventCategory[] = [];
  for (const [cat, words] of Object.entries(INTEREST_WORDS) as [EventCategory, string[]][]) {
    const hit = findPhrase(q, words);
    if (hit) {
      interests.push(cat);
      signals.push({ kind: "interest", value: cat, label: titleCase(hit), source: hit });
    }
  }

  const goals: Goal[] = [];
  for (const [goal, words] of Object.entries(GOAL_WORDS) as [Goal, string[]][]) {
    const hit = findPhrase(q, words);
    if (hit) {
      goals.push(goal);
      signals.push({ kind: "goal", value: goal, label: GOAL_LABEL[goal], source: hit });
    }
  }

  let when: When = "any";
  for (const [value, words] of WHEN_WORDS) {
    const hit = findPhrase(q, words);
    if (hit) {
      when = value;
      signals.push({ kind: "when", value, label: titleCase(hit), source: hit });
      break;
    }
  }

  let city: string | null = null;
  const cityHit = findPhrase(q, CITY_WORDS);
  if (cityHit) {
    city = cityHit === "bangalore" ? "Bengaluru" : titleCase(cityHit);
    signals.push({ kind: "where", value: city, label: city, source: cityHit });
  }

  const freeHit = findPhrase(q, FREE_WORDS);
  if (freeHit) signals.push({ kind: "budget", value: "free", label: "Free", source: freeHit });

  let format: EventFormat | null = null;
  const onlineHit = findPhrase(q, ONLINE_WORDS);
  const inPersonHit = findPhrase(q, IN_PERSON_WORDS);
  if (onlineHit) {
    format = "online";
    signals.push({ kind: "format", value: "online", label: "Online", source: onlineHit });
  } else if (inPersonHit) {
    format = "in_person";
    signals.push({ kind: "format", value: "in_person", label: "In person", source: inPersonHit });
  }

  const unsupported: string[] = [];
  for (const [name, words] of UNSUPPORTED) {
    if (findPhrase(q, words)) unsupported.push(name);
  }

  // Goals widen the net: "learn AI" should also surface workshops, not only
  // events whose category word appeared outright.
  const widened = new Set(interests);
  for (const g of goals) for (const c of GOAL_CATEGORIES[g]) widened.add(c);

  return {
    text,
    signals,
    interests: [...widened],
    goals,
    when,
    city,
    freeOnly: Boolean(freeHit),
    format,
    unsupported,
  };
}

/** Remove one signal and recompute the derived fields. */
export function dropSignal(intent: Intent, signal: Signal): Intent {
  const signals = intent.signals.filter(
    (s) => !(s.kind === signal.kind && s.value === signal.value),
  );
  const interests = new Set<EventCategory>();
  const goals: Goal[] = [];
  let when: When = "any";
  let city: string | null = null;
  let freeOnly = false;
  let format: EventFormat | null = null;

  for (const s of signals) {
    if (s.kind === "interest") interests.add(s.value as EventCategory);
    if (s.kind === "goal") goals.push(s.value as Goal);
    if (s.kind === "when") when = s.value as When;
    if (s.kind === "where") city = s.value;
    if (s.kind === "budget") freeOnly = true;
    if (s.kind === "format") format = s.value as EventFormat;
  }
  for (const g of goals) for (const c of GOAL_CATEGORIES[g]) interests.add(c);

  return { ...intent, signals, interests: [...interests], goals, when, city, freeOnly, format };
}

export interface Scored {
  event: Event;
  score: number;
  /** Plain-language reasons, shown on the card so a match is never a black box. */
  reasons: string[];
}

export function scoreEvent(event: Event, intent: Intent): Scored | null {
  const reasons: string[] = [];
  let score = 0;

  if (intent.interests.length) {
    if (!intent.interests.includes(event.category)) return null;
    const named = intent.signals.find(
      (s) => s.kind === "interest" && s.value === event.category,
    );
    score += named ? 3 : 2;
    reasons.push(named ? `Matches ${named.label}` : "Related to what you asked for");
  }

  if (intent.when !== "any") {
    if (!matchesWindow(event.start_time, intent.when)) return null;
    score += 2;
    reasons.push(intent.when === "weekend" ? "On this weekend" : `Happening ${intent.when}`);
  }

  if (intent.city) {
    if ((event.city ?? "").toLowerCase() !== intent.city.toLowerCase()) return null;
    score += 2;
    reasons.push(`In ${intent.city}`);
  }

  if (intent.freeOnly) {
    if (!event.is_free) return null;
    score += 2;
    reasons.push("Free to attend");
  }

  if (intent.format) {
    const fmt = event.format ?? "in_person";
    if (fmt !== intent.format) return null;
    score += 1;
    reasons.push(intent.format === "online" ? "Online" : "In person");
  }

  // Free-text overlap on whatever the signals did not already explain.
  const words = intent.text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const hay = `${event.title} ${event.description ?? ""}`.toLowerCase();
  const hits = words.filter((w) => hay.includes(w));
  if (hits.length) score += Math.min(hits.length, 3);

  if (score === 0) return null;
  return { event, score, reasons };
}

export interface Group {
  key: string;
  title: string;
  items: Scored[];
}

const GROUP_DEFS: { key: string; title: string; cats: EventCategory[] }[] = [
  { key: "build", title: "Build something", cats: ["tech"] },
  { key: "learn", title: "Learn something new", cats: ["education"] },
  { key: "meet", title: "Meet interesting people", cats: ["business", "community"] },
  { key: "move", title: "Get out and move", cats: ["sports", "outdoor", "health"] },
  { key: "explore", title: "Explore something different", cats: ["arts", "food", "music", "nightlife", "family", "other"] },
];

/**
 * Rank, then group. Groups only appear when they hold something, so a narrow
 * query returns one tight section rather than a page of empty headings.
 */
export function groupResults(events: Event[], intent: Intent): {
  best: Scored[];
  groups: Group[];
  total: number;
} {
  const scored = events
    .map((e) => scoreEvent(e, intent))
    .filter((s): s is Scored => s !== null)
    .sort((a, b) => b.score - a.score || Date.parse(a.event.start_time) - Date.parse(b.event.start_time));

  const best = scored.slice(0, 3);
  const bestIds = new Set(best.map((s) => s.event.id));
  const rest = scored.filter((s) => !bestIds.has(s.event.id));

  const groups: Group[] = [];
  for (const def of GROUP_DEFS) {
    const items = rest.filter((s) => def.cats.includes(s.event.category));
    if (items.length) groups.push({ key: def.key, title: def.title, items });
  }

  return { best, groups, total: scored.length };
}

/** Prompts shown under the search field. Each exercises a different dimension. */
export const EXAMPLE_PROMPTS = [
  "I want to learn AI, meet founders, and do something this weekend",
  "Free tech meetups in Bengaluru",
  "Beginner-friendly design workshops",
  "Something outdoors I can do with my family",
  "Online machine learning conferences",
];
