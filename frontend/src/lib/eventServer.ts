import { cache } from "react";
import { unstable_cache } from "next/cache";
import { clean, getEvent } from "@/lib/api";
import { rest, rpc, supabaseConfigured } from "@/lib/supabaseServer";
import type { Event } from "@/lib/types";

/** Read the event straight from the database: the same RPC the API uses. */
async function fromDatabase(id: string): Promise<Event | null> {
  const [rows, extra] = await Promise.all([
    rpc<Event[]>("get_event_by_id", { p_id: id }, 6_000),
    rest<Partial<Event>[]>(`events?select=tickets,details,details_fetched_at&id=eq.${id}`).catch(() => []),
  ]);
  const row = rows?.[0];
  return row ? clean({ ...row, ...(extra[0] ?? {}) } as Event) : null;
}

// Kept for five minutes, like the API copy, so repeat views skip the database.
const cachedFromDatabase = unstable_cache(fromDatabase, ["event-by-id"], { revalidate: 300 });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The event for its page, read straight from the database (one hop from the
 * site; the API on Render is two and sometimes asleep), cached for five
 * minutes. The API is used only where the database isn't configured.
 * Shared per request by metadata, page and share image.
 */
export const loadEvent = cache(async (id: string): Promise<Event | null> => {
  if (!UUID.test(id) || !supabaseConfigured()) return getEvent(id);
  // No fallback to the API here: it reads the same database, so when the
  // database is struggling a second try only adds load. The page's error
  // screen retries on its own a few seconds later.
  return cachedFromDatabase(id);
});
