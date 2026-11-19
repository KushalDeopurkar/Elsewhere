import { rpc, supabaseConfigured } from "./supabaseServer";

/** Server-only: what a poll link's preview needs (asker, question, events). */
export interface PollPreview {
  who: string;
  title: string;
  decided: boolean;
  events: { id: string; title: string; image_url: string | null; category: string; votes: number }[];
}

interface Raw {
  title: string;
  event_ids: string[];
  winner: string | null;
  creator: { username: string; display_name: string | null } | null;
  votes: { event_id: string }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function pollPreview(id: string): Promise<PollPreview | null> {
  if (!supabaseConfigured() || !UUID.test(id)) return null;
  try {
    const p = await rpc<Raw | null>("get_poll", { p_id: id, p_key: null }, 6000);
    if (!p) return null;
    const rows = await rpc<{ id: string; title: string; image_url: string | null; category: string }[]>(
      "events_by_ids",
      { ids: p.event_ids },
      6000,
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    return {
      who: p.creator?.display_name || p.creator?.username || "A friend",
      title: p.title,
      decided: Boolean(p.winner),
      events: p.event_ids
        .map((eid) => byId.get(eid))
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .map((e) => ({ ...e, votes: p.votes.filter((v) => v.event_id === e.id).length })),
    };
  } catch {
    return null;
  }
}
