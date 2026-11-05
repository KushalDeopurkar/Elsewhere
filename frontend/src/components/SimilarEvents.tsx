import EventCard from "./EventCard";
import { similarEvents } from "@/lib/semantic";
import { supabaseConfigured } from "@/lib/supabaseServer";

/** "More like this" on an event page. Renders nothing if it cannot help. */
export default async function SimilarEvents({ eventId }: { eventId: string }) {
  if (!supabaseConfigured()) return null;
  let events: Awaited<ReturnType<typeof similarEvents>> = [];
  try {
    events = await similarEvents(eventId, 6);
  } catch (err) {
    console.warn("[similar]", (err as Error).message);
    return null;
  }
  if (events.length === 0) return null;

  return (
    <section className="shell section">
      <div className="section-head">
        <h2>More like this</h2>
        <span className="section-link">Matched by meaning, not just category</span>
      </div>
      <div className="grid-results">
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </section>
  );
}
