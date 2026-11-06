import type { Event } from "./types";
import type { PlanResult } from "./plan";
import { formatWhen } from "./formatDate";

/** wa.me opens WhatsApp (app or web) with the text ready to send to anyone. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function eventShareText(e: Event, origin: string): string {
  const where = [e.location_name, e.city].filter(Boolean).join(", ");
  return [`*${e.title}*`, `${formatWhen(e.start_time)}${where ? ` · ${where}` : ""}`, `${origin}/events/${e.id}`].join("\n");
}

const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });

export function planShareText(plan: PlanResult, url: string): string {
  const stops = plan.stops.map((s, i) => `${i + 1}. ${time.format(new Date(s.event.start_time)).toLowerCase()}  ${s.event.title}`);
  return [`*${plan.title}*`, ...stops, "", `Full plan with the route: ${url}`].join("\n");
}
