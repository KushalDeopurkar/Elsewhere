import EventCard from "./EventCard";
import { SectionHeader } from "./Section";
import { similarEvents } from "@/lib/semantic";
import { supabaseConfigured } from "@/lib/supabaseServer";

/** "More like this" on an event page. Renders nothing if it cannot help. */
export default async function SimilarEvents({ eventId, title }: { eventId: string; title: string }) {
  if (!supabaseConfigured()) return null;
  let events: Awaited<ReturnType<typeof similarEvents>> = [];
  try {
    events = await similarEvents(eventId, 6, title);
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
