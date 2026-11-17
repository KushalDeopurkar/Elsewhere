"use client";

/**
 * What we already know about an event the moment its card is clicked, so the
 * event page's loading state can show the real picture and title at once
 * (and the card-to-hero transition has something real to land on) while
 * the full page loads.
 */
import type { Event } from "./types";

export type EventPreview = Pick<Event, "id" | "title" | "image_url" | "category" | "city">;

const previews = new Map<string, EventPreview>();

export function rememberPreview(e: EventPreview): void {
  previews.set(e.id, { id: e.id, title: e.title, image_url: e.image_url, category: e.category, city: e.city });
  if (previews.size > 50) previews.delete(previews.keys().next().value!);
}

export function getPreview(id: string | undefined): EventPreview | undefined {
  return id ? previews.get(id) : undefined;
}
