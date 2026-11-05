/**
 * Meaning-based search over events (server only).
 *
 * Events and queries are embedded with gte-small by the `embed` Edge Function
 * and compared in Postgres with pgvector (see migration 005). Everything here
 * throws on failure; callers decide how to degrade (usually to keyword search).
 */

import { Event } from "./types";
import { invokeFunction, rpc } from "./supabaseServer";

export const EMBED_DIMS = 384;
// The free Edge Function tier has a small CPU budget per call: a few short
// texts per request, two requests at a time. Oversized batches are split.
const EMBED_BATCH = 3;
const EMBED_CONCURRENCY = 2;
// gte-small reads ~512 tokens; longer text only costs CPU.
const EMBED_MAX_CHARS = 700;

export interface SemanticEvent extends Event {
  /** Cosine similarity to the query, 0..1. */
  similarity: number;
  created_at: string;
}

interface Row extends Omit<SemanticEvent, "relevance" | "format"> {
  similarity: number;
}

function toEvent(r: Row): SemanticEvent {
  return {
    ...r,
    price_min: r.price_min == null ? null : Number(r.price_min),
    price_max: r.price_max == null ? null : Number(r.price_max),
    is_free: Boolean(r.is_free),
    relevance: r.similarity,
    similarity: r.similarity,
  };
}

async function callEmbed(texts: string[]): Promise<number[][]> {
  const out = await invokeFunction<{ embeddings?: number[][] }>("embed", {
    texts: texts.map((t) => t.slice(0, EMBED_MAX_CHARS)),
  });
  const vecs = out.embeddings;
  if (!Array.isArray(vecs) || vecs.length !== texts.length || vecs.some((v) => v.length !== EMBED_DIMS)) {
    throw new Error("embed returned an unexpected shape");
  }
  return vecs;
}

/**
 * Embed a batch, splitting it in half whenever the function runs out of
 * resources. A single text that still fails is retried shortened, so one
 * awkward listing can never stall the whole sync.
 */
async function embedBatch(texts: string[]): Promise<number[][]> {
  try {
    return await callEmbed(texts);
  } catch (err) {
    if (texts.length > 1) {
      const mid = Math.ceil(texts.length / 2);
      const [a, b] = [await embedBatch(texts.slice(0, mid)), await embedBatch(texts.slice(mid))];
      return [...a, ...b];
    }
    try {
      return await callEmbed(texts);
    } catch {
      return await callEmbed([texts[0].slice(0, 200)]).catch(() => {
        throw err;
      });
    }
  }
}

/** Embed many texts, in small batches with limited parallelism. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) batches.push(texts.slice(i, i + EMBED_BATCH));
  const results: number[][][] = new Array(batches.length);
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const i = next++;
      results[i] = await embedBatch(batches[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(EMBED_CONCURRENCY, batches.length) }, worker));
  return results.flat();
}

// Warm functions see the same few demo queries repeatedly.
const queryCache = new Map<string, number[]>();

export async function embedQuery(text: string): Promise<number[]> {
  const key = text.trim().toLowerCase();
  const hit = queryCache.get(key);
  if (hit) return hit;
  const [vec] = await embedBatch([key]);
  if (queryCache.size > 300) queryCache.delete(queryCache.keys().next().value as string);
  queryCache.set(key, vec);
  return vec;
}

export function vectorLiteral(vec: number[]): string {
  return `[${vec.map((x) => (Number.isFinite(x) ? x.toFixed(6) : "0")).join(",")}]`;
}

export async function matchEvents(opts: {
  /** A vector, or a pgvector literal as stored ("[0.1,...]"). */
  embedding: number[] | string;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  from?: Date;
  to?: Date | null;
  count?: number;
  minSimilarity?: number;
}): Promise<SemanticEvent[]> {
  const rows = await rpc<Row[]>("match_events", {
    query_embedding: typeof opts.embedding === "string" ? opts.embedding : vectorLiteral(opts.embedding),
    p_lat: opts.lat ?? null,
    p_lng: opts.lng ?? null,
    radius_km: opts.radiusKm ?? 40,
    from_time: (opts.from ?? new Date()).toISOString(),
    to_time: opts.to ? opts.to.toISOString() : null,
    match_count: opts.count ?? 30,
    min_similarity: opts.minSimilarity ?? 0,
  });
  return rows.map(toEvent);
}

function titleTokens(title: string): Set<string> {
  return new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1));
}

function sameListing(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared) >= 0.75;
}

/**
 * Drop the same event listed by several sources ("Startup Club l Mumbai" vs
 * "Startup Club | Mumbai"). Different shows from one organiser share some
 * words but stay well under the overlap threshold, so they are kept.
 */
export function dedupeListings<T extends { title: string }>(events: T[], exclude: string[] = []): T[] {
  const seen = exclude.map(titleTokens);
  const out: T[] = [];
  for (const e of events) {
    const tokens = titleTokens(e.title);
    if (seen.some((s) => sameListing(s, tokens))) continue;
    seen.push(tokens);
    out.push(e);
  }
  return out;
}

export async function similarEvents(eventId: string, count = 6, sourceTitle?: string): Promise<SemanticEvent[]> {
  // Over-fetch: duplicates of the source and of each other are removed below.
  const rows = await rpc<Row[]>("similar_events", { p_event_id: eventId, match_count: count * 3 });
  return dedupeListings(rows.map(toEvent), sourceTitle ? [sourceTitle] : []).slice(0, count);
}

/**
 * Embed upcoming events that are new or changed, until the time budget runs
 * out. Idempotent: safe to call repeatedly or concurrently.
 */
export async function syncEmbeddings(budgetMs = 45_000): Promise<{ embedded: number; remaining: number }> {
  const started = Date.now();
  let embedded = 0;

  while (Date.now() - started < budgetMs) {
    const pending = await rpc<{ id: string; content: string; content_hash: string }[]>(
      "events_pending_embedding",
      { batch_size: 48 },
    );
    if (pending.length === 0) break;

    const vecs = await embedTexts(pending.map((p) => p.content));
    const items = pending.map((p, i) => ({
      id: p.id,
      hash: p.content_hash,
      embedding: vectorLiteral(vecs[i]),
    }));
    embedded += await rpc<number>("set_event_embeddings", { items });
    if (pending.length < 48) break;
  }

  const remaining = await rpc<number>("events_pending_embedding_count", {});
  return { embedded, remaining };
}
