"use client";

import { createStore } from "./clientStore";
import { CITY_LIST, DEFAULT_CITY, CityPoint } from "./cities";

const store = createStore<string>("ee.city.v1", DEFAULT_CITY.name);

/** The city the person picked in the header; Mumbai until they choose. */
export function useCity(): CityPoint {
  const name = store.useValue();
  return CITY_LIST.find((c) => c.name === name) ?? DEFAULT_CITY;
}

let quiet = false;

/** Set the city. `quiet`: chosen for the person (first-visit guess), so the map should just be there, not fly. */
export function setCity(name: string, opts: { quiet?: boolean } = {}): void {
  quiet = Boolean(opts.quiet);
  store.write(name);
}

/** Whether the latest city change was a quiet one (read once by the map). */
export function lastCityChangeQuiet(): boolean {
  const q = quiet;
  quiet = false;
  return q;
}

// Picking the city that's already chosen changes nothing in the store, but
// the map still wants to know (to fly back to it after you've dragged away).
const REPICK = "ee:city-repick";

/** Choose a city from the picker: a change if it's new, a re-pick if not. */
export function pickCity(name: string): void {
  quiet = false;
  if (name === store.read()) window.dispatchEvent(new CustomEvent(REPICK, { detail: name }));
  else store.write(name);
}

export function onCityRepick(fn: (name: string) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<string>).detail);
  window.addEventListener(REPICK, h);
  return () => window.removeEventListener(REPICK, h);
}

/** Recent searches, each with the city it was made in (older entries have none). */
type Recent = string | { q: string; city: string };
const recent = createStore<Recent[]>("ee.recent-searches.v1", []);
const textOf = (r: Recent) => (typeof r === "string" ? r : r.q);

/** This city's recent searches (searches saved before cities were kept count everywhere). */
export function useRecentSearches(city?: string): string[] {
  const all = recent.useValue();
  return all
    .filter((r) => !city || typeof r === "string" || r.city === city)
    .map(textOf)
    .slice(0, 6);
}

/** Remember a search that found something, for this city. */
export function rememberSearch(q: string, city?: string): void {
  const text = q.trim();
  if (text.length < 2) return;
  const entry: Recent = city ? { q: text, city } : text;
  const same = (r: Recent) => textOf(r).toLowerCase() === text.toLowerCase() && (typeof r === "string" || !city || r.city === city);
  recent.write([entry, ...recent.read().filter((r) => !same(r))].slice(0, 18));
}

export function clearRecentSearches(): void {
  recent.write([]);
}
