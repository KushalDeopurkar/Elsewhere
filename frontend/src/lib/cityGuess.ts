import { CITY_LIST, type CityPoint } from "./cities";

/** The nearest picker city within `maxKm`, or null. */
export function nearestCity(lat: number, lng: number, maxKm = 150): CityPoint | null {
  let best: CityPoint | null = null;
  let bestKm = Infinity;
  for (const c of CITY_LIST) {
    const dLat = ((c.lat - lat) * Math.PI) / 180;
    const dLng = ((c.lng - lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((c.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const km = 2 * 6371 * Math.asin(Math.sqrt(a));
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return bestKm <= maxKm ? best : null;
}

// Zones that point to one picker city. India's single zone can't tell its
// cities apart, so it isn't here (the IP lookup handles India).
const BY_ZONE: Record<string, string> = {
  "America/New_York": "New York", "America/Los_Angeles": "Los Angeles", "America/Chicago": "Chicago",
  "America/Toronto": "Toronto", "America/Vancouver": "Vancouver", "America/Mexico_City": "Mexico City",
  "Europe/London": "London", "Europe/Dublin": "Dublin", "Europe/Paris": "Paris", "Europe/Berlin": "Berlin",
  "Europe/Amsterdam": "Amsterdam", "Europe/Madrid": "Madrid", "Europe/Brussels": "Brussels",
  "Europe/Copenhagen": "Copenhagen", "Europe/Stockholm": "Stockholm", "Australia/Sydney": "Sydney",
  "Australia/Melbourne": "Melbourne", "Australia/Brisbane": "Brisbane", "Australia/Perth": "Perth",
  "Pacific/Auckland": "Auckland", "Asia/Singapore": "Singapore",
};

/** A city from the browser's time zone, when the zone names one. */
export function cityFromZone(zone: string | undefined): string | null {
  return (zone && BY_ZONE[zone]) || null;
}
