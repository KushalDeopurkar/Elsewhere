"use client";

import { createStore } from "./clientStore";
import { CITY_LIST, DEFAULT_CITY, CityPoint } from "./cities";

const store = createStore<string>("ee.city.v1", DEFAULT_CITY.name);

/** The city the person picked in the header; Mumbai until they choose. */
export function useCity(): CityPoint {
  const name = store.useValue();
  return CITY_LIST.find((c) => c.name === name) ?? DEFAULT_CITY;
}

export function setCity(name: string): void {
  store.write(name);
}

const recent = createStore<string[]>("ee.recent-searches.v1", []);

export function useRecentSearches(): string[] {
  return recent.useValue();
}

export function rememberSearch(q: string): void {
  const text = q.trim();
  if (text.length < 2) return;
  recent.write([text, ...recent.read().filter((r) => r.toLowerCase() !== text.toLowerCase())].slice(0, 6));
}

export function clearRecentSearches(): void {
  recent.write([]);
}
