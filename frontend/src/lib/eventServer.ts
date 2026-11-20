import { cache } from "react";
import { clean, getEvent } from "@/lib/api";
import { rest, rpc, supabaseConfigured } from "@/lib/supabaseServer";
import type { Event } from "@/lib/types";

/** Read the event straight from the database: the same RPC the API uses. */
async function fromDatabase(id: string): Promise<Event | null> {
  const [rows, extra] = await Promise.all([
    rpc<Event[]>("get_event_by_id", { p_id: id }, 8_000),
    rest<Partial<Event>[]>(`events?select=tickets,details,details_fetched_at&id=eq.${id}`).catch(() => []),
  ]);
  const row = rows?.[0];
  return row ? clean({ ...row, ...(extra[0] ?? {}) } as Event) : null;
}

/**
 * The event for its page. The API on Render can be asleep or restarting;
 * when it can't answer, read the database directly instead of failing the
 * page. Cached per request so metadata and page share one lookup.
 */
export const loadEvent = cache(async (id: string): Promise<Event | null> => {
  try {
    return await getEvent(id);
  } catch (e) {
    if (!supabaseConfigured()) throw e;
    console.warn(`[event ${id}] API unreachable, reading the database`, e instanceof Error ? e.message : e);
    return fromDatabase(id);
  }
});
