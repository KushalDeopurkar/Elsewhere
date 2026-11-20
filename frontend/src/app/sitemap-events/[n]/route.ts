import { rest, supabaseConfigured } from "@/lib/supabaseServer";
import { SITE_URL } from "@/lib/site";
import { EVENTS_PER_FILE, MAX_EVENT_FILES, SITEMAP_HEADERS, todayIso, urlset } from "@/lib/sitemapXml";

export const revalidate = 21600;

const PAGE = 1000;

/** One file of upcoming events, read as five pages in parallel. */
export async function GET(_req: Request, { params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 0 || n >= MAX_EVENT_FILES) return new Response("Not found", { status: 404 });
  let ids: string[] = [];
  if (supabaseConfigured()) {
    try {
      const start = n * EVENTS_PER_FILE;
      const pages = await Promise.all(
        Array.from({ length: EVENTS_PER_FILE / PAGE }, (_, i) =>
          rest<{ id: string }[]>(
            `events?select=id&start_time=gte.${todayIso()}&order=start_time.asc,id.asc&offset=${start + i * PAGE}&limit=${PAGE}`,
          ),
        ),
      );
      ids = pages.flat().map((r) => r.id);
    } catch {
      return new Response(urlset([]), { headers: { ...SITEMAP_HEADERS, "Cache-Control": "public, s-maxage=300" } });
    }
  }
  const rows = ids.map((id) => ({ loc: `${SITE_URL}/events/${id}`, changefreq: "daily", priority: 0.5 }));
  return new Response(urlset(rows), { headers: SITEMAP_HEADERS });
}
