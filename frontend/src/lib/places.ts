"use client";

import { createStore } from "./clientStore";

/** A starting point the viewer saved on this device (no accounts yet). */
export interface Place {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

const places = createStore<Place[]>("ee.places.v1", []);
/** Id of the chosen starting point, or "here" for the current location. */
const origin = createStore<string | null>("ee.origin.v1", null);

export const usePlaces = () => places.useValue();
export const useOriginId = () => origin.useValue();
export const setOriginId = (id: string | null) => origin.write(id);

export function addPlace(p: Omit<Place, "id">): Place {
  const place = { ...p, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
  places.write([place, ...places.read().filter((x) => x.label !== p.label || p.label === "Other")].slice(0, 5));
  origin.write(place.id);
  return place;
}

export function removePlace(id: string): void {
  places.write(places.read().filter((p) => p.id !== id));
  if (origin.read() === id) origin.write(null);
}
