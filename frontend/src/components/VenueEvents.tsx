import EventCard from "./EventCard";
import { SectionHeader } from "./Section";
import { clean } from "@/lib/api";
import { dedupeEvents } from "@/lib/tidy";
import { rest, supabaseConfigured } from "@/lib/supabaseServer";
import type { Event } from "@/lib/types";

const COLS = "id,title,description,category,start_time,end_time,location_name,address,city,country,image_url,url,price_min,price_max,is_free,source,tickets";

/** Names that aren't a place you can go to, so "more here" means nothing. */
const NOT_A_VENUE = /^(online|virtual|zoom|tba|tbd|to be announced|venue (tba|tbd|to be announced)|multiple venues|various venues|secret location|location (tba|on request))$/i;

/**
 * "More at {venue}": every upcoming show listed at the same place, soonest
 * first, so one visit to a venue's page shows its whole calendar. Renders
 * nothing when the venue is unknown or this is its only listing.
 */
export default async function VenueEvents({ event }: { event: Event }) {
  const venue = event.location_name?.trim();
  if (!venue || !supabaseConfigured()) return null;
  if (NOT_A_VENUE.test(venue) || venue.toLowerCase() === event.city?.trim().toLowerCase()) return null;

  let rows: Event[] = [];
  try {
    const since = new Date(Date.now() - 3 * 3_600_000).toISOString(); // include what's on now
    const city = event.city ? `&city=eq.${encodeURIComponent(event.city)}` : "";
    rows = await rest<Event[]>(
      `events?select=${COLS}&location_name=eq.${encodeURIComponent(venue)}${city}&start_time=gte.${since}&id=neq.${event.id}&order=start_time.asc&limit=40`,
    );
  } catch (err) {
    console.warn("[venue]", (err as Error).message);
    return null;
  }
  const shows = dedupeEvents(
    rows.map((r) => clean({ ...r, lat: null, lng: null, distance_km: null, relevance: null } as Event)),
  ).filter((e) => e.id !== event.id);
  if (shows.length === 0) return null;

  const shown = shows.slice(0, 12);
  return (
    <section className="shell sec venue-more">
      <SectionHeader
        kicker={`${shows.length} more upcoming ${shows.length === 1 ? "show" : "shows"} at this venue`}
        title={`More at ${venue}`}
        href={shows.length > shown.length ? `/explore?q=${encodeURIComponent(venue)}` : undefined}
        linkLabel="Every show here"
      />
      <div className="grid-results">
        {shown.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </section>
  );
}
