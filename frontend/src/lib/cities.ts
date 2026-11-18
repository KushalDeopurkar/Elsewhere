/**
 * City and neighbourhood lookup for the planner.
 *
 * Coordinates match the centroids the scrapers fall back to, so a radius
 * search around a city lands on the same points the events were stored at.
 * Neighbourhoods map to their parent city: the planner searches the city and
 * lets the model (or the rules) prefer stops near the named area.
 */

export interface CityPoint {
  name: string;
  lat: number;
  lng: number;
  /** ISO country code; India when absent. */
  country?: string;
  /** IANA time zone; Asia/Kolkata when absent. */
  tz?: string;
}

// Outside India. Keep in step with backend/app/scrapers/world.py: the global
// sources are fetched around these same points.
const WORLD: CityPoint[] = [
  { name: "New York", lat: 40.7128, lng: -74.006, country: "US", tz: "America/New_York" },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437, country: "US", tz: "America/Los_Angeles" },
  { name: "Chicago", lat: 41.8781, lng: -87.6298, country: "US", tz: "America/Chicago" },
  { name: "San Francisco", lat: 37.7749, lng: -122.4194, country: "US", tz: "America/Los_Angeles" },
  { name: "Austin", lat: 30.2672, lng: -97.7431, country: "US", tz: "America/Chicago" },
  { name: "Miami", lat: 25.7617, lng: -80.1918, country: "US", tz: "America/New_York" },
  { name: "Seattle", lat: 47.6062, lng: -122.3321, country: "US", tz: "America/Los_Angeles" },
  { name: "Boston", lat: 42.3601, lng: -71.0589, country: "US", tz: "America/New_York" },
  { name: "Washington DC", lat: 38.9072, lng: -77.0369, country: "US", tz: "America/New_York" },
  { name: "Las Vegas", lat: 36.1699, lng: -115.1398, country: "US", tz: "America/Los_Angeles" },
  { name: "Nashville", lat: 36.1627, lng: -86.7816, country: "US", tz: "America/Chicago" },
  { name: "Toronto", lat: 43.6532, lng: -79.3832, country: "CA", tz: "America/Toronto" },
  { name: "Vancouver", lat: 49.2827, lng: -123.1207, country: "CA", tz: "America/Vancouver" },
  { name: "Montreal", lat: 45.5019, lng: -73.5674, country: "CA", tz: "America/Toronto" },
  { name: "Mexico City", lat: 19.4326, lng: -99.1332, country: "MX", tz: "America/Mexico_City" },
  { name: "London", lat: 51.5074, lng: -0.1278, country: "GB", tz: "Europe/London" },
  { name: "Manchester", lat: 53.4808, lng: -2.2426, country: "GB", tz: "Europe/London" },
  { name: "Birmingham", lat: 52.4862, lng: -1.8904, country: "GB", tz: "Europe/London" },
  { name: "Glasgow", lat: 55.8642, lng: -4.2518, country: "GB", tz: "Europe/London" },
  { name: "Dublin", lat: 53.3498, lng: -6.2603, country: "IE", tz: "Europe/Dublin" },
  { name: "Paris", lat: 48.8566, lng: 2.3522, country: "FR", tz: "Europe/Paris" },
  { name: "Berlin", lat: 52.52, lng: 13.405, country: "DE", tz: "Europe/Berlin" },
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041, country: "NL", tz: "Europe/Amsterdam" },
  { name: "Madrid", lat: 40.4168, lng: -3.7038, country: "ES", tz: "Europe/Madrid" },
  { name: "Barcelona", lat: 41.3874, lng: 2.1686, country: "ES", tz: "Europe/Madrid" },
  { name: "Brussels", lat: 50.8503, lng: 4.3517, country: "BE", tz: "Europe/Brussels" },
  { name: "Copenhagen", lat: 55.6761, lng: 12.5683, country: "DK", tz: "Europe/Copenhagen" },
  { name: "Stockholm", lat: 59.3293, lng: 18.0686, country: "SE", tz: "Europe/Stockholm" },
  { name: "Sydney", lat: -33.8688, lng: 151.2093, country: "AU", tz: "Australia/Sydney" },
  { name: "Melbourne", lat: -37.8136, lng: 144.9631, country: "AU", tz: "Australia/Melbourne" },
  { name: "Brisbane", lat: -27.4698, lng: 153.0251, country: "AU", tz: "Australia/Brisbane" },
  { name: "Perth", lat: -31.9505, lng: 115.8605, country: "AU", tz: "Australia/Perth" },
  { name: "Auckland", lat: -36.8485, lng: 174.7633, country: "NZ", tz: "Pacific/Auckland" },
  { name: "Wellington", lat: -41.2865, lng: 174.7762, country: "NZ", tz: "Pacific/Auckland" },
  { name: "Christchurch", lat: -43.5321, lng: 172.6362, country: "NZ", tz: "Pacific/Auckland" },
  { name: "Singapore", lat: 1.3521, lng: 103.8198, country: "SG", tz: "Asia/Singapore" },
];

const CITIES: Record<string, CityPoint> = {
  mumbai: { name: "Mumbai", lat: 19.076, lng: 72.878 },
  delhi: { name: "Delhi", lat: 28.614, lng: 77.209 },
  bengaluru: { name: "Bengaluru", lat: 12.972, lng: 77.595 },
  hyderabad: { name: "Hyderabad", lat: 17.385, lng: 78.487 },
  chennai: { name: "Chennai", lat: 13.083, lng: 80.271 },
  kolkata: { name: "Kolkata", lat: 22.573, lng: 88.364 },
  pune: { name: "Pune", lat: 18.52, lng: 73.857 },
  ahmedabad: { name: "Ahmedabad", lat: 23.023, lng: 72.571 },
  jaipur: { name: "Jaipur", lat: 26.912, lng: 75.787 },
  kochi: { name: "Kochi", lat: 9.932, lng: 76.267 },
  goa: { name: "Goa", lat: 15.3, lng: 73.914 },
  chandigarh: { name: "Chandigarh", lat: 30.733, lng: 76.779 },
  indore: { name: "Indore", lat: 22.72, lng: 75.858 },
  lucknow: { name: "Lucknow", lat: 26.847, lng: 80.947 },
  gurgaon: { name: "Gurgaon", lat: 28.459, lng: 77.027 },
  noida: { name: "Noida", lat: 28.535, lng: 77.391 },
  thiruvananthapuram: { name: "Thiruvananthapuram", lat: 8.525, lng: 76.936 },
  coimbatore: { name: "Coimbatore", lat: 11.017, lng: 76.956 },
  guwahati: { name: "Guwahati", lat: 26.144, lng: 91.736 },
  bhopal: { name: "Bhopal", lat: 23.259, lng: 77.413 },
  nagpur: { name: "Nagpur", lat: 21.146, lng: 79.088 },
  vadodara: { name: "Vadodara", lat: 22.307, lng: 73.181 },
  visakhapatnam: { name: "Visakhapatnam", lat: 17.687, lng: 83.218 },
  mysuru: { name: "Mysuru", lat: 12.295, lng: 76.639 },
  dehradun: { name: "Dehradun", lat: 30.316, lng: 78.032 },
  udaipur: { name: "Udaipur", lat: 24.585, lng: 73.712 },
  jodhpur: { name: "Jodhpur", lat: 26.238, lng: 73.024 },
  ...Object.fromEntries(WORLD.map((c) => [c.name.toLowerCase(), c])),
};

/** Spellings and nearby areas, all lower case, pointing at a CITIES key. */
const ALIASES: Record<string, string> = {
  nyc: "new york",
  "new york city": "new york",
  sf: "san francisco",
  "washington d.c.": "washington dc",
  montréal: "montreal",
  bombay: "mumbai",
  bangalore: "bengaluru",
  blr: "bengaluru",
  "new delhi": "delhi",
  ncr: "delhi",
  gurugram: "gurgaon",
  "navi mumbai": "mumbai",
  thane: "mumbai",
  calcutta: "kolkata",
  madras: "chennai",
  cochin: "kochi",
  trivandrum: "thiruvananthapuram",
  mysore: "mysuru",
  vizag: "visakhapatnam",
  // Mumbai
  bandra: "mumbai", andheri: "mumbai", juhu: "mumbai", powai: "mumbai",
  colaba: "mumbai", worli: "mumbai", "lower parel": "mumbai", dadar: "mumbai",
  bkc: "mumbai", goregaon: "mumbai", malad: "mumbai", borivali: "mumbai",
  khar: "mumbai", versova: "mumbai", chembur: "mumbai",
  "kala ghoda": "mumbai", mahalaxmi: "mumbai",
  // Bengaluru
  koramangala: "bengaluru", indiranagar: "bengaluru", hsr: "bengaluru",
  whitefield: "bengaluru", jayanagar: "bengaluru", "mg road": "bengaluru",
  "electronic city": "bengaluru", "jp nagar": "bengaluru",
  // Delhi
  "hauz khas": "delhi", "connaught place": "delhi", saket: "delhi",
  "cyber hub": "gurgaon", "vasant kunj": "delhi", "khan market": "delhi",
  // Hyderabad / Pune / Chennai
  "hitech city": "hyderabad", "banjara hills": "hyderabad", "jubilee hills": "hyderabad",
  gachibowli: "hyderabad", koregaon: "pune", "koregaon park": "pune",
  baner: "pune", "t nagar": "chennai", adyar: "chennai",
};

/** Aliases that are another name for the whole city, not an area inside it. */
const SPELLINGS = new Set([
  "bombay", "bangalore", "blr", "new delhi", "ncr", "gurugram", "navi mumbai",
  "thane", "calcutta", "madras", "cochin", "trivandrum", "mysore", "vizag",
]);

function hasWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(haystack);
}

/** First city or neighbourhood named in free text, longest names first. */
export function detectCity(text: string): { city: CityPoint; area: string | null } | null {
  const q = text.toLowerCase();
  const aliasKeys = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
  const cityKeys = Object.keys(CITIES).sort((a, b) => b.length - a.length);

  for (const key of cityKeys) {
    if (hasWord(q, key)) return { city: CITIES[key], area: null };
  }
  for (const key of aliasKeys) {
    if (hasWord(q, key)) {
      return { city: CITIES[ALIASES[key]], area: SPELLINGS.has(key) ? null : key };
    }
  }
  return null;
}

export function cityByName(name: string | null | undefined): CityPoint | null {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  return CITIES[key] ?? (ALIASES[key] ? CITIES[ALIASES[key]] : null);
}

export const DEFAULT_CITY = CITIES.mumbai;

/** Indian cities in the location selector, most active first. */
export const INDIA_LIST: CityPoint[] = [
  "mumbai", "bengaluru", "delhi", "hyderabad", "pune", "chennai", "kolkata",
  "gurgaon", "noida", "ahmedabad", "jaipur", "goa", "kochi", "chandigarh",
  "indore", "lucknow", "coimbatore", "thiruvananthapuram", "guwahati",
].map((k) => CITIES[k]);

/** Cities outside India, alphabetical. */
export const WORLD_LIST: CityPoint[] = [...WORLD].sort((a, b) => a.name.localeCompare(b.name));

/** Every city in the location selector. */
export const CITY_LIST: CityPoint[] = [...INDIA_LIST, ...WORLD_LIST];

export const cityZone = (c: CityPoint | null | undefined): string => c?.tz ?? "Asia/Kolkata";
export const cityCountry = (c: CityPoint | null | undefined): string => c?.country ?? "IN";

/**
 * The time zone an event's times should read in: the zone of the nearest
 * known city (all of India is one zone). Deterministic, so the server and
 * the browser format the same string.
 */
export function zoneOf(e: { lat?: number | null; lng?: number | null; country?: string | null }): string {
  const country = (e.country ?? "").toUpperCase();
  if (!country || country === "IN") return "Asia/Kolkata";
  const pool = WORLD.filter((c) => c.country === country);
  if (pool.length === 1 || (pool.length && (e.lat == null || e.lng == null))) return pool[0].tz!;
  if (e.lat != null && e.lng != null) {
    const list = pool.length ? pool : WORLD;
    let best = list[0];
    let bestD = Infinity;
    for (const c of list) {
      const d = (c.lat - e.lat) ** 2 + ((c.lng - e.lng) * Math.cos((e.lat * Math.PI) / 180)) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    // Far from every known city (> ~1,000 km): fall back to India's zone
    // only if nothing better is known.
    if (bestD < 100) return best.tz!;
  }
  return "Asia/Kolkata";
}

/**
 * True when a point sits on a city centroid: the scrapers' fallback when a
 * listing has no venue coordinates, so the real venue could be anywhere in town.
 */
export function isCityCentroid(lat: number, lng: number): boolean {
  return Object.values(CITIES).some((c) => Math.abs(c.lat - lat) < 0.002 && Math.abs(c.lng - lng) < 0.002);
}
