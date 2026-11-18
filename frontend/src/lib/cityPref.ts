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

// Picking the city that's already chosen changes nothing in the store, but
// the map still wants to know (to fly back to it after you've dragged away).
const REPICK = "ee:city-repick";

/** Choose a city from the picker: a change if it's new, a re-pick if not. */
export function pickCity(name: string): void {
  if (name === store.read()) window.dispatchEvent(new CustomEvent(REPICK, { detail: name }));
  else store.write(name);
}

export function onCityRepick(fn: (name: string) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<string>).detail);
  window.addEventListener(REPICK, h);
  return () => window.removeEventListener(REPICK, h);
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
