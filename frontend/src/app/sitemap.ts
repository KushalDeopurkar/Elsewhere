import type { MetadataRoute } from "next";
import { CATEGORY_PAGES } from "@/lib/categoryPages";
import { SITE_URL } from "@/lib/site";
import { rest, supabaseConfigured } from "@/lib/supabaseServer";

// Rebuilt a few times a day, in step with the scrapers.
export const revalidate = 21600;

const MAX_EVENTS = 40_000; // a sitemap file holds up to 50,000 links

/** Public pages search engines should find: the main pages, categories and every upcoming event. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/explore`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/map`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/plan-my-day`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.1 },
    ...CATEGORY_PAGES.map((c) => ({ url: `${SITE_URL}/categories/${c.slug}`, changeFrequency: "daily" as const, priority: 0.7 })),
  ];
  if (!supabaseConfigured()) return fixed;

  const events: MetadataRoute.Sitemap = [];
  try {
    for (let from = 0; from < MAX_EVENTS; from += 1000) {
      const rows = await rest<{ id: string; start_time: string }[]>(
        `events?select=id,start_time&start_time=gte.${now.toISOString()}&order=start_time.asc&offset=${from}&limit=1000`,
      );
      for (const r of rows) {
        events.push({ url: `${SITE_URL}/events/${r.id}`, changeFrequency: "daily", priority: 0.5 });
      }
      if (rows.length < 1000) break;
    }
  } catch {
    /* the fixed pages are still worth listing */
  }
  return [...fixed, ...events];
}
