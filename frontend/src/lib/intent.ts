import { CATEGORIES, Event, EventCategory, EventFormat } from "./types";
import { fuzzyHas, isTypoOf, wordsOf } from "./fuzzy";
import { detectCity } from "./cities";
import {
  addDays,
  inDays,
  inHours,
  inPriceCap,
  localDay,
  readDays,
  readHours,
  readPrice,
  type DayRange,
  type Hours,
  type PriceCap,
} from "./when";

/**
 * The search reader. It takes a request in plain words and splits it into
 * what the data can answer: the words to find (matched against titles,
 * venues and descriptions, typos forgiven), dates ("on 22nd", "next
 * friday", "22-25 dec"), a time of day, a price ("under 500", "free"), a
 * place, a format, and broad categories ("music", "tech"). Every part
 * becomes a chip that can be removed, so a wrong guess costs one click.
 *
 * Exactness comes first: when the request has words to find, an event
 * counts as a match only if every word is found in it (or, for a few
 * words like "concert", it is in that category). Events that only share
 * the topic, or that /api/semantic finds close in meaning, are offered
 * separately as related, never mixed in as if they matched.
 *
 * Dimensions the schema cannot support (experience level, group size) are
 * detected and said out loud rather than silently ignored.
 */

export type Goal = "learn" | "meet" | "build" | "move" | "unwind" | "create" | "give";
export type When = "any" | "today" | "tomorrow" | "weekend";

export interface Signal {
  kind: "interest" | "goal" | "when" | "time" | "where" | "budget" | "format" | "words";
  /** Machine value, e.g. an EventCategory, "range", "free" or the words. */
  value: string;
  /** What the chip shows. */
  label: string;
  /** The words in the query that produced it. */
  source: string;
  /** For dates, times and prices: what was read. */
  range?: DayRange;
  hours?: Hours;
  cap?: PriceCap;
  /** Interests named by a broad category word ("music") filter; others only rank. */
  strict?: boolean;
}

export interface Intent {
  text: string;
  signals: Signal[];
  /** Every category the request points at (strict and soft). */
  interests: EventCategory[];
  /** Categories named outright ("music", "tech"): results must be in one. */
  strict: EventCategory[];
  goals: Goal[];
  /** Kept for the date chips and widening: today/tomorrow/weekend when the range is exactly that. */
  when: When;
  range: DayRange | null;
  hours: Hours | null;
  city: string | null;
  freeOnly: boolean;
  cap: PriceCap | null;
  format: EventFormat | null;
  /** Words to find in the event, lower case; "phrases" were typed in quotes. */
  terms: string[];
  phrases: string[];
  /** Any one of the words is enough ("a run or a match", or after widening). */
  anyOf: boolean;
  /** Dimensions the user asked for that the data cannot answer. */
  unsupported: string[];
}

export interface ReadOptions {
  now?: number;
  /** The search city's time zone: dates are its calendar days. */
  zone?: string;
  /** "22/11" is the 22nd of November; false for US cities (month first). */
  dayFirst?: boolean;
  /** What "cheap" means in the city's money (500 in India, 25 elsewhere). */
  cheap?: number;
}

const INTEREST_WORDS: Record<EventCategory, string[]> = {
  tech: ["ai", "artificial intelligence", "machine learning", "ml", "hackathon", "hack", "coding", "code", "developer", "dev", "programming", "robotics", "tech", "technology", "software", "data", "open source", "engineer"],
  business: ["startup", "founder", "entrepreneur", "investor", "pitch", "networking", "network", "business", "career", "vc", "funding", "summit", "expo"],
  education: ["workshop", "course", "bootcamp", "lecture", "seminar", "class", "training", "webinar", "masterclass", "talk", "conference", "lecture"],
  arts: ["art", "comedy", "stand up", "standup", "stand-up", "open mic", "exhibition", "gallery", "theatre", "theater", "poetry", "film", "cinema", "photography", "design", "museum", "literature", "book", "culture", "creative", "play", "musical", "dance", "ballet", "opera", "screening", "painting", "pottery", "craft", "standup comedy"],
  sports: ["sport", "football", "cricket", "match", "marathon", "run", "running", "tournament", "fitness", "gym", "esports", "game day", "cycling", "badminton", "tennis", "basketball", "5k", "10k"],
  music: ["music", "concert", "gig", "band", "festival", "live music", "dj", "singer", "jazz", "rock", "indie", "edm", "hip hop", "rap", "classical", "karaoke", "choir", "orchestra", "recital"],
  community: ["community", "meetup", "social", "volunteer", "volunteering", "charity", "board game", "club", "language exchange", "meet people", "friends", "quiz", "trivia", "book club", "chess"],
  food: ["food", "cooking", "tasting", "culinary", "restaurant", "dinner", "brunch", "coffee", "baking", "drink", "wine", "beer", "brewery", "food festival", "market"],
  health: ["yoga", "wellness", "meditation", "wellbeing", "mindfulness", "health", "mental health", "therapy"],
  outdoor: ["outdoor", "outdoors", "hike", "hiking", "trek", "trekking", "camping", "nature", "walk", "adventure", "cycling"],
  family: ["family", "kids", "children", "child", "toddler", "parent"],
  nightlife: ["nightlife", "club", "clubbing", "party", "late night", "bar", "pub", "rave"],
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

const CATEGORY_LABEL: Record<EventCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<EventCategory, string>;

const GOAL_LABEL: Record<Goal, string> = {
  learn: "Learn", meet: "Meet people", build: "Build", move: "Get active",
  unwind: "Unwind", create: "Create", give: "Give back",
};

const WHEN_WORDS: [When, string[]][] = [
  ["weekend", ["this weekend", "weekend", "saturday", "sunday"]],
  ["tomorrow", ["tomorrow"]],
  ["today", ["today", "tonight", "this evening", "right now"]],
];


const FREE_WORDS = ["free", "no cost", "zero cost", "no money", "free entry", "free admission"];
const CHEAP_WORDS = ["cheap", "affordable", "budget", "inexpensive", "low cost"];
const ONLINE_WORDS = ["online", "remote", "virtual", "from home", "livestream"];
const IN_PERSON_WORDS = ["in person", "in-person", "nearby", "near me", "around me"];

/** Dimensions the schema has no column for. Detected so they can be said out loud. */
const UNSUPPORTED: [string, string[]][] = [
  ["experience level", ["beginner friendly", "beginner-friendly", "advanced", "intermediate", "student only", "for students"]],
  ["group size", ["solo", "with friends", "alone"]],
];


/** Every word and phrase the reader understands, for the spelling corrector (lib/spell.ts). */
export const QUERY_PHRASES: string[] = [
  ...Object.values(INTEREST_WORDS).flat(),
  ...Object.values(GOAL_WORDS).flat(),
  ...WHEN_WORDS.flatMap(([, w]) => w),
  ...FREE_WORDS,
  ...CHEAP_WORDS,
  ...ONLINE_WORDS,
  ...IN_PERSON_WORDS,
  "morning", "afternoon", "evening", "night", "weekend", "week", "month",
  "january", "february", "march", "april", "june", "july", "august", "september", "october", "november", "december",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "under", "below", "between", "after", "before", "christmas", "halloween",
];

const ACRONYMS: Record<string, string> = {
  ai: "AI", ml: "ML", vc: "VC", dj: "DJ", edm: "EDM", "artificial intelligence": "AI",
  "machine learning": "Machine learning", "open source": "Open source",
};

const titleCase = (s: string) =>
  ACRONYMS[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function findPhrase(haystack: string, needles: string[]): string | null {
  for (const n of needles) {
    // Plurals count: "workshops", "founders", "hackathons", "matches".
    const re = new RegExp(`(^|[^a-z])${escapeRe(n)}(e?s)?([^a-z]|$)`, "i");
    if (re.test(haystack)) return n;
  }
  return null;
}

/** Category words broad enough to mean "only this kind of event". */
const BROAD: Record<string, EventCategory> = {
  tech: "tech", technology: "tech", business: "business", education: "education", learning: "education",
  educational: "education", sporty: "sports", musical: "music", artsy: "arts", foodie: "food",
  art: "arts", arts: "arts", culture: "arts", sport: "sports", sports: "sports", fitness: "sports",
  music: "music", community: "community", social: "community", food: "food", drink: "food",
  health: "health", wellness: "health", wellbeing: "health", lifestyle: "health",
  outdoor: "outdoor", outdoors: "outdoor", nature: "outdoor", travel: "outdoor",
  family: "family", nightlife: "nightlife",
};

/**
 * Words whose listings rarely say the word itself: an event in the
 * category counts as a match ("concert" finds "Arijit Singh Live").
 */
const CATEGORY_LIKE: Record<string, EventCategory> = {
  concert: "music", gig: "music", "live music": "music", live: "music", band: "music", dj: "music",
  party: "nightlife", clubbing: "nightlife", "club night": "nightlife",
  ai: "tech", "artificial intelligence": "tech", "machine learning": "tech", ml: "tech", coding: "tech",
  developer: "tech", programming: "tech", robotics: "tech", software: "tech",
  startup: "business", founder: "business", entrepreneur: "business", investor: "business", networking: "business",
  volunteering: "community", volunteer: "community", meetup: "community",
  run: "sports", running: "sports", match: "sports", game: "sports", tournament: "sports", fitness: "sports",
  hike: "outdoor", trek: "outdoor", trekking: "outdoor",
  yoga: "health", meditation: "health",
  kids: "family", children: "family",
};

/** Other ways listings say the same thing, in English and the languages our cities list in. */
const SYNONYMS: Record<string, string[]> = {
  workshop: ["atelier", "masterclass", "werkstatt", "taller"],
  exhibition: ["exposition", "expo", "exhibit", "ausstellung", "exposición", "mostra"],
  concert: ["gig", "live music", "konzert", "concierto", "recital"],
  comedy: ["comedian", "standup", "stand-up", "stand up", "humour", "humor", "comédie", "open mic"],
  standup: ["stand-up", "stand up", "comedy", "comedian"],
  "standup comedy": ["stand-up comedy", "stand up comedy", "comedy", "comedian", "standup"],
  talk: ["lecture", "conference", "conférence", "seminar", "keynote", "panel"],
  kids: ["children", "child", "family", "enfants", "toddler", "kinder"],
  walk: ["balade", "tour", "stroll", "promenade"],
  party: ["soirée", "club night", "rave", "fiesta"],
  dance: ["danse", "salsa", "bachata", "ballet", "tanz"],
  run: ["running", "marathon", "5k", "10k", "run club"],
  film: ["movie", "cinema", "screening", "cinéma", "kino"],
  hackathon: ["hack", "hackathons"],
  meetup: ["meet-up", "meet up"],
  theatre: ["theater", "théâtre", "play", "drama"],
  quiz: ["trivia", "pub quiz"],
};

/** Phrases kept whole as one thing to find, and the form they are looked for in. */
const PHRASE_TERMS: [string, string][] = [
  ["stand up comedy", "standup comedy"], ["stand-up comedy", "standup comedy"],
  ["stand up", "standup"], ["stand-up", "standup"], ["open mic", "open mic"], ["live music", "live music"],
  ["board games", "board game"], ["board game", "board game"], ["book club", "book club"], ["pub quiz", "pub quiz"],
  ["food festival", "food festival"], ["art exhibition", "exhibition"], ["heritage walk", "heritage walk"],
  ["run club", "run club"], ["wine tasting", "wine tasting"], ["film screening", "screening"],
];

/** Words that carry no topic: never required in a title. */
const FILLER = new Set(
  (
    "a an and or the in on at to of for from by with near around me my i we you us it is are be am was " +
    "what whats where when which who how any some all this that these those there here " +
    "event events thing things stuff something anything everything happening happenings going on show " +
    "find get go see want wanna looking look need like love would could can please let lets " +
    "best good great top nice cool fun interesting popular upcoming new latest local nearby city town " +
    "place places spot spots do doing attend attending join visit check out plan plans " +
    "today tonight tomorrow week weekend month day days night morning evening afternoon " +
    "next this coming later soon now right"
  ).split(" "),
);

/** "workshops" is found as "workshop", "classes" as "class". */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function parseIntent(raw: string, opts: ReadOptions = {}): Intent {
  const text = raw.trim();
  const now = opts.now ?? Date.now();
  const lower = text.toLowerCase();
  const q = ` ${lower} `;
  const signals: Signal[] = [];
  // What is left once each part has been read: the words to find.
  let rest = ` ${lower.replace(/[“”]/g, '"')} `;
  const take = (src: string) => {
    rest = rest.replace(new RegExp(`(^|[^a-z0-9])${escapeRe(src.toLowerCase())}(?:e?s)?(?=[^a-z0-9]|$)`, "i"), "$1 ");
  };

  // Words in quotes must appear exactly as typed.
  const phrases: string[] = [];
  rest = rest.replace(/"([^"]+)"/g, (_, p: string) => {
    if (p.trim()) phrases.push(p.trim().toLowerCase());
    return " ";
  });

  // Where: a city or neighbourhood, or online.
  let city: string | null = null;
  let format: EventFormat | null = null;
  const placeHit = detectCity(q);
  if (placeHit) {
    city = placeHit.city.name;
    const src = placeHit.area ?? placeHit.city.name.toLowerCase();
    signals.push({ kind: "where", value: city, label: placeHit.area ? `${titleCase(placeHit.area)}, ${city}` : city, source: src });
    take(src);
    // Spellings of the city ("bombay") and areas are read as the city too.
    for (const w of wordsOf(lower)) if (w !== src && detectCity(w)?.city.name === city) take(w);
  }
  const onlineHit = findPhrase(q, ONLINE_WORDS);
  const inPersonHit = findPhrase(q, IN_PERSON_WORDS);
  if (onlineHit) {
    format = "online";
    signals.push({ kind: "format", value: "online", label: "Online", source: onlineHit });
    take(onlineHit);
  } else if (inPersonHit) {
    format = "in_person";
    signals.push({ kind: "format", value: "in_person", label: "In person", source: inPersonHit });
    take(inPersonHit);
  }

  // When: dates and a time of day, in the city's calendar.
  const zone = opts.zone ?? "Asia/Kolkata";
  const range = readDays(text, now, zone, opts.dayFirst ?? true);
  if (range) {
    signals.push({ kind: "when", value: "range", label: range.label, source: range.source, range });
    take(range.source);
  }
  const hours = readHours(text);
  if (hours) {
    signals.push({ kind: "time", value: "hours", label: hours.label, source: hours.source, hours });
    take(hours.source);
  }

  // Money: free, cheap, or a limit.
  let cap: PriceCap | null = readPrice(text);
  const freeHit = findPhrase(q, FREE_WORDS);
  if (freeHit) {
    signals.push({ kind: "budget", value: "free", label: "Free", source: freeHit });
    take(freeHit);
    cap = null;
  } else if (cap) {
    signals.push({ kind: "budget", value: "cap", label: cap.label, source: cap.source, cap });
    take(cap.source);
  } else {
    const cheapHit = findPhrase(q, CHEAP_WORDS);
    if (cheapHit) {
      const max = opts.cheap ?? 500;
      cap = { min: null, max, label: `Cheap (under ${max})`, source: cheapHit };
      signals.push({ kind: "budget", value: "cap", label: cap.label, source: cheapHit, cap });
      take(cheapHit);
    }
  }

  // Known phrases ("live music", "stand up") are one thing to find: hide
  // them before reading categories, so "music" in "live music" isn't read
  // on its own and "live" left behind as a word every title must contain.
  const masked: string[] = [];
  let qx = q;
  for (const [phrase, as] of PHRASE_TERMS) {
    const re = new RegExp(`(^|[^a-z])${escapeRe(phrase)}(?=[^a-z]|$)`, "gi");
    if (!re.test(qx)) continue;
    const token = ` zzphrase${masked.length}zz `;
    masked.push(as);
    qx = qx.replace(re, `$1${token}`);
    rest = rest.replace(new RegExp(`(^|[^a-z])${escapeRe(phrase)}(?=[^a-z]|$)`, "gi"), `$1${token}`);
  }

  // What kind: broad category words filter, the rest only rank.
  const strict: EventCategory[] = [];
  const soft: EventCategory[] = [];
  for (const [cat, words] of Object.entries(INTEREST_WORDS) as [EventCategory, string[]][]) {
    const hit = findPhrase(qx, words);
    if (!hit) continue;
    const broad = BROAD[hit] === cat;
    (broad ? strict : soft).push(cat);
    signals.push({ kind: "interest", value: cat, label: titleCase(hit), source: hit, strict: broad });
    if (broad) take(hit);
  }
  // A broad word that isn't in the interest list ("family", "outdoors") still filters.
  for (const w of wordsOf(qx)) {
    const cat = BROAD[w];
    if (cat && !strict.includes(cat) && !signals.some((s) => s.kind === "interest" && s.value === cat && s.strict)) {
      strict.push(cat);
      const old = signals.findIndex((s) => s.kind === "interest" && s.value === cat);
      if (old >= 0) signals.splice(old, 1);
      signals.push({ kind: "interest", value: cat, label: titleCase(w), source: w, strict: true });
      take(w);
    }
  }

  const goals: Goal[] = [];
  for (const [goal, words] of Object.entries(GOAL_WORDS) as [Goal, string[]][]) {
    const hit = findPhrase(qx, words);
    if (hit && !BROAD[hit]) {
      goals.push(goal);
      signals.push({ kind: "goal", value: goal, label: GOAL_LABEL[goal], source: hit });
      // A goal phrase ("meet people", "learn") says why, not what to find.
      if (!Object.values(INTEREST_WORDS).some((ws) => ws.includes(hit))) take(hit);
    }
  }

  const unsupported: string[] = [];
  for (const [name, words] of UNSUPPORTED) {
    const hit = findPhrase(q, words);
    if (hit) {
      unsupported.push(name);
      take(hit);
    }
  }


  // "a run or a match": any one of the words will do.
  const anyOf = /(^|\s)(or|either)(\s|$)/.test(rest);

  // The words to find: what is left, minus words that carry no topic.
  const terms = [...new Set(
    rest
      .replace(/[^a-z0-9\u00c0-\u024f+#&'_ -]/gi, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^['-]+|['-]+$/g, ""))
      .map((w) => {
        const m = /^zzphrase(\d+)zz$/.exec(w);
        return m ? masked[Number(m[1])] : w;
      })
      .filter((w) => w.length > 1 && !FILLER.has(w) && !/^\d+$/.test(w) && w !== "either"),
  )];
  if (terms.length || phrases.length) {
    const shown = [...phrases.map((p) => `“${p}”`), ...terms].join(" ");
    const label = anyOf && terms.length > 1 ? terms.join(" or ") : shown;
    signals.push({ kind: "words", value: `${anyOf ? "~" : ""}${[...terms, ...phrases.map((p) => `"${p}"`)].join("|")}`, label, source: shown });
  }

  return build(text, signals, { city, format, unsupported, now, zone });
}

/** The intent described by a set of signals (after reading, dropping or widening). */
function build(
  text: string,
  signals: Signal[],
  ctx: { city?: string | null; format?: EventFormat | null; unsupported: string[]; now?: number; zone?: string },
): Intent {
  const strict = new Set<EventCategory>();
  const soft = new Set<EventCategory>();
  const goals: Goal[] = [];
  let range: DayRange | null = null;
  let hours: Hours | null = null;
  let city: string | null = null;
  let freeOnly = false;
  let cap: PriceCap | null = null;
  let format: EventFormat | null = null;
  let terms: string[] = [];
  let phrases: string[] = [];
  let anyOf = false;
  for (const s of signals) {
    if (s.kind === "interest") (s.strict ? strict : soft).add(s.value as EventCategory);
    if (s.kind === "goal") goals.push(s.value as Goal);
    if (s.kind === "when" && s.range) range = s.range;
    if (s.kind === "time" && s.hours) hours = s.hours;
    if (s.kind === "where") city = s.value;
    if (s.kind === "budget") {
      if (s.value === "free") freeOnly = true;
      else if (s.cap) cap = s.cap;
    }
    if (s.kind === "format") format = s.value as EventFormat;
    if (s.kind === "words") {
      anyOf = s.value.startsWith("~");
      const parts = s.value.replace(/^~/, "").split("|").filter(Boolean);
      phrases = parts.filter((p) => p.startsWith('"')).map((p) => p.slice(1, -1));
      terms = parts.filter((p) => !p.startsWith('"'));
    }
  }
  for (const g of goals) for (const c of GOAL_CATEGORIES[g]) soft.add(c);
  void ctx;
  return {
    text,
    signals,
    interests: [...new Set([...strict, ...soft])],
    strict: [...strict],
    goals,
    when: whenOf(range, ctx.now ?? Date.now(), ctx.zone ?? "Asia/Kolkata"),
    range,
    hours,
    city,
    freeOnly,
    cap,
    format,
    terms,
    phrases,
    anyOf,
    unsupported: ctx.unsupported,
  };
}

function whenOf(range: DayRange | null, now: number, zone: string): When {
  if (!range) return "any";
  const today = localDay(now, zone);
  if (range.from === today && range.to === today) return "today";
  if (range.from === addDays(today, 1) && range.to === range.from) return "tomorrow";
  return "any";
}

/** Remove one signal and recompute the derived fields. */
export function dropSignal(intent: Intent, signal: Signal): Intent {
  const signals = intent.signals.filter((s) => !(s.kind === signal.kind && s.value === signal.value));
  return build(intent.text, signals, { unsupported: intent.unsupported });
}

/** Does the event fall in the asked-for days and time, in its own local time? */
export function matchesIntentWhen(event: Event, intent: Pick<Intent, "range" | "hours">): boolean {
  if (intent.range && !inDays(event, intent.range)) return false;
  if (intent.hours && !inHours(event, intent.hours)) return false;
  return true;
}

/** Everything except the words: date, time, price, format and strict categories. */
export function passesFilters(event: Event, intent: Intent): boolean {
  if (intent.strict.length && !intent.strict.includes(event.category)) return false;
  if (!matchesIntentWhen(event, intent)) return false;
  if (intent.freeOnly && !event.is_free) return false;
  if (intent.cap && !inPriceCap(event, intent.cap)) return false;
  if (intent.format && (event.format ?? "in_person") !== intent.format) return false;
  return true;
}

export interface Scored {
  event: Event;
  score: number;
  /** Plain-language reasons, shown on the card so a match is never a black box. */
  reasons: string[];
  /** Every word and phrase asked for was found (or there were none to find). */
  exact: boolean;
}

interface Fields {
  title: string[];
  place: string[];
  body: string[];
  titleText: string;
  allText: string;
}
const fieldsOf = (e: Event): Fields => {
  const titleText = (e.title ?? "").toLowerCase();
  const placeText = `${e.location_name ?? ""} ${e.address ?? ""}`.toLowerCase();
  const bodyText = (e.description ?? "").toLowerCase();
  return {
    title: wordsOf(titleText),
    place: wordsOf(placeText),
    body: wordsOf(bodyText),
    titleText: wordsOf(titleText).join(" "),
    allText: wordsOf(`${titleText} ${placeText} ${bodyText}`).join(" "),
  };
};

/** Where a word was found: 3 in the title, 2 at the venue, 1 in the description, 0 not at all. */
function findTerm(term: string, f: Fields, category: EventCategory): number {
  const forms = [term, stem(term), ...(SYNONYMS[term] ?? SYNONYMS[stem(term)] ?? [])];
  const has = (words: string[], text: string) =>
    forms.some((w) => (w.includes(" ") || w.includes("-") ? text.includes(wordsOf(w).join(" ")) : fuzzyHas(words, wordsOf(w)[0] ?? w)));
  if (has(f.title, f.titleText)) return 3;
  if (has(f.place, f.place.join(" "))) return 2;
  if (has(f.body, f.allText)) return 1;
  const like = CATEGORY_LIKE[term] ?? CATEGORY_LIKE[stem(term)];
  if (like && like === category) return 2;
  return 0;
}

/**
 * How well an event answers the request, or null if it fails a filter
 * (date, time, price, format, a broad category) or has nothing in common
 * with it. `exact` is true only when every word asked for was found.
 */
export function scoreEvent(event: Event, intent: Intent): Scored | null {
  if (!passesFilters(event, intent)) return null;
  const reasons: string[] = [];
  let score = 0;

  const f = fieldsOf(event);
  let found = 0;
  const hitWords: string[] = [];
  for (const t of intent.terms) {
    const at = findTerm(t, f, event.category);
    if (at) {
      found += 1;
      score += at * 2;
      hitWords.push(t);
    }
  }
  let phrasesFound = 0;
  for (const p of intent.phrases) {
    const want = wordsOf(p).join(" ");
    if (f.titleText.includes(want)) {
      phrasesFound += 1;
      score += 10;
    } else if (f.allText.includes(want)) {
      phrasesFound += 1;
      score += 5;
    }
  }
  const wanted = intent.terms.length + intent.phrases.length;
  const exact = intent.anyOf
    ? found + phrasesFound > 0
    : found === intent.terms.length && phrasesFound === intent.phrases.length;
  // All the words, in order, in the title: the strongest match there is.
  if (intent.terms.length > 1 && exact && f.titleText.includes(intent.terms.map((t) => wordsOf(t).join(" ")).join(" "))) score += 12;
  if (wanted && exact) {
    reasons.push(`Matches “${[...intent.phrases, ...intent.terms].join(" ")}”`);
  } else if (found + phrasesFound > 0) {
    reasons.push(`Mentions ${[...hitWords, ...intent.phrases].map((w) => `“${w}”`).join(", ")}`);
  }

  const softCats = intent.interests.filter((c) => !intent.strict.includes(c));
  const inSoft = softCats.includes(event.category);
  if (inSoft) {
    score += 2;
    const named = intent.signals.find((s) => s.kind === "interest" && s.value === event.category);
    const goal = intent.goals.find((g) => GOAL_CATEGORIES[g].includes(event.category));
    if (!wanted || !exact) reasons.push(named ? `${CATEGORY_LABEL[event.category]}, like “${named.label.toLowerCase()}”` : goal ? `${CATEGORY_LABEL[event.category]}, for “${GOAL_LABEL[goal]}”` : CATEGORY_LABEL[event.category]);
  }
  if (intent.strict.length) {
    score += 1;
    reasons.push(CATEGORY_LABEL[event.category]);
  }

  if (wanted) {
    // Nothing in common with the words, and not even the topic: not a result.
    if (found + phrasesFound === 0 && !inSoft) return null;
  } else if (softCats.length && !inSoft && !intent.strict.length) {
    return null;
  }

  if (intent.range) reasons.push(intent.range.label === "Today" || intent.range.label === "Tomorrow" ? `Happening ${intent.range.label.toLowerCase()}` : `On ${intent.range.label}`);
  if (intent.hours) reasons.push(intent.hours.label);
  if (intent.freeOnly) reasons.push("Free to attend");
  if (intent.cap) reasons.push(intent.cap.max != null ? `Under ${intent.cap.max}` : intent.cap.label);
  if (intent.format) reasons.push(intent.format === "online" ? "Online" : "In person");
  if (intent.city) reasons.push(`In ${intent.city}`);

  return { event, score: score + (wanted ? 0 : 1), reasons: [...new Set(reasons)], exact: wanted ? exact : true };
}

/** Typo-tolerant check that a word appears in the event (used to test spellings). */
export const mentions = (e: Event, word: string) => {
  const f = fieldsOf(e);
  return f.title.some((w) => isTypoOf(word, w)) || findTerm(word, f, e.category) > 0;
};

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
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score || Date.parse(a.event.start_time) - Date.parse(b.event.start_time));

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



/**
 * The home page's suggested searches, one per kind of plan, with the price
 * in the city's own money. Every one is tested to return real matches
 * (intent.test.ts), so a suggestion never leads to an empty page.
 */
export function homePrompts(money: { symbol: string; cheap: number } = { symbol: "₹", cheap: 500 }): string[] {
  return [
    "Free AI workshops this weekend",
    "I want to meet startup founders",
    "Something educational tomorrow",
    "Volunteering this Sunday",
    "A run or a match this weekend",
    `Live music today under ${money.symbol}${money.cheap}`,
  ];
}

/** Parts of a request that can be let go of to widen a thin result. */
export type Widen = "when" | "free" | "topic" | "words";

/**
 * The request with the named parts let go: any date or time, any price,
 * any category, or only some of the words. The signals shown to the person
 * drop the same parts, so the "Reading as" line always matches what is
 * being searched.
 */
export function widenIntent(intent: Intent, widen: Widen[]): Intent {
  if (widen.length === 0) return intent;
  const drop = new Set<string>();
  if (widen.includes("when")) {
    drop.add("when");
    drop.add("time");
  }
  if (widen.includes("free")) drop.add("budget");
  if (widen.includes("topic")) {
    drop.add("interest");
    drop.add("goal");
  }
  // Widening the words means any one of them will do, never "anything at all".
  const signals = intent.signals
    .filter((s) => !drop.has(s.kind))
    .map((s) => (widen.includes("words") && s.kind === "words" && !s.value.startsWith("~") ? { ...s, value: `~${s.value}`, label: s.label.split(" ").join(" or ") } : s));
  return build(intent.text, signals, { unsupported: intent.unsupported });
}

/** Which parts of this request could be widened at all. */
export function widenable(intent: Intent): Widen[] {
  const out: Widen[] = [];
  if (intent.range || intent.hours) out.push("when");
  if (intent.freeOnly || intent.cap) out.push("free");
  if (intent.interests.length || intent.goals.length) out.push("topic");
  if (intent.terms.length + intent.phrases.length > 1 && !intent.anyOf) out.push("words");
  return out;
}
