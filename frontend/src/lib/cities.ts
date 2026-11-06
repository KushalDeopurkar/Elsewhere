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
}

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
};

/** Spellings and nearby areas, all lower case, pointing at a CITIES key. */
const ALIASES: Record<string, string> = {
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

/** Cities offered in the location selector, most active first. */
export const CITY_LIST: CityPoint[] = [
  "mumbai", "bengaluru", "delhi", "hyderabad", "pune", "chennai", "kolkata",
  "gurgaon", "noida", "ahmedabad", "jaipur", "goa", "kochi", "chandigarh",
  "indore", "lucknow", "coimbatore", "thiruvananthapuram", "guwahati",
].map((k) => CITIES[k]);

/**
 * True when a point sits on a city centroid: the scrapers' fallback when a
 * listing has no venue coordinates, so the real venue could be anywhere in town.
 */
export function isCityCentroid(lat: number, lng: number): boolean {
  return Object.values(CITIES).some((c) => Math.abs(c.lat - lat) < 0.002 && Math.abs(c.lng - lng) < 0.002);
}
