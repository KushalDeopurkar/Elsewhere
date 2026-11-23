import { unstable_cache } from "next/cache";
import EventCard from "./EventCard";
import { SectionHeader } from "./Section";
import { similarEvents } from "@/lib/semantic";
import { supabaseConfigured } from "@/lib/supabaseServer";

/**
 * The matches for an event change only when new events are embedded (once
 * a day), and the vector search is the heaviest query the site makes: keep
 * each event's answer for an hour.
 */
const cachedSimilar = unstable_cache(
  (eventId: string, title: string) => similarEvents(eventId, 6, title),
  ["similar-events-v1"],
  { revalidate: 3600 },
);

/** "More like this" on an event page. Renders nothing if it cannot help. */
export default async function SimilarEvents({ eventId, title }: { eventId: string; title: string }) {
  if (!supabaseConfigured()) return null;
  let events: Awaited<ReturnType<typeof similarEvents>> = [];
  try {
    events = await cachedSimilar(eventId, title);
  } catch (err) {
    console.warn("[similar]", (err as Error).message);
    return null;
  }
  if (events.length === 0) return null;

  return (
    <section className="shell sec">
      <SectionHeader kicker="Matched by what it's about, not only its category" title="More like this" />
      <div className="grid-results">
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </section>
  );
}
