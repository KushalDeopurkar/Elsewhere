import { count, supabaseConfigured } from "@/lib/supabaseServer";
import { EVENTS_PER_FILE, MAX_EVENT_FILES, SITEMAP_HEADERS, sitemapIndex, todayIso } from "@/lib/sitemapXml";

export const revalidate = 21600;

/** Sitemap index: the fixed pages, then upcoming events in files of 5,000. */
export async function GET() {
  let files = 0;
  if (supabaseConfigured()) {
    try {
      const n = await count(`events?start_time=gte.${todayIso()}`);
      files = Math.min(MAX_EVENT_FILES, Math.ceil(n / EVENTS_PER_FILE));
    } catch {
      files = 1; // list the first file; it degrades to empty on its own
    }
  }
  const paths = ["/sitemap-pages.xml", ...Array.from({ length: files }, (_, i) => `/sitemap-events/${i}`)];
  return new Response(sitemapIndex(paths), { headers: SITEMAP_HEADERS });
}
