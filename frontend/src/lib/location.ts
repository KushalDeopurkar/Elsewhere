import { PlaceSelection } from "./filters";

/**
 * Reference coordinates for city selection.
 *
 * Static geographic facts, not event data — they only supply an origin point
 * for the API's real radius search. Geolocation is offered first; this list
 * is the manual fallback for a denied or unavailable permission.
 */
export const CITIES: PlaceSelection[] = [
  { label: "Mumbai", lat: 19.076, lng: 72.8777 },
  { label: "Delhi", lat: 28.6139, lng: 77.209 },
  { label: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { label: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { label: "Chennai", lat: 13.0827, lng: 80.2707 },
  { label: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { label: "Pune", lat: 18.5204, lng: 73.8567 },
  { label: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { label: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { label: "Kochi", lat: 9.9312, lng: 76.2673 },
  { label: "Goa", lat: 15.2993, lng: 73.9122 },
  { label: "Chandigarh", lat: 30.7333, lng: 76.7794 },
];

export const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export type GeolocationOutcome =
  | { ok: true; place: PlaceSelection }
  | { ok: false; reason: string };

/**
 * Ask the browser for the user's position.
 *
 * Resolves rather than rejects so callers can show the reason inline and
 * fall back to manual city selection.
 */
export function requestCurrentPlace(): Promise<GeolocationOutcome> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, reason: "This browser can't share a location." });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          place: {
            label: "Near me",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
        });
      },
      (err) => {
        const reason =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — pick a city instead."
            : err.code === err.TIMEOUT
              ? "Location request timed out — pick a city instead."
              : "Couldn't determine your location — pick a city instead.";
        resolve({ ok: false, reason });
      },
      { timeout: 10_000, maximumAge: 300_000 }
    );
  });
}
