import { SITE_URL } from "@/lib/site";

/** Event links per sitemap file. Small files build fast and cache well. */
export const EVENTS_PER_FILE = 5000;
export const MAX_EVENT_FILES = 10;

/** Cached at the edge for 6 hours (the scrape cadence), served stale for a day. */
export const SITEMAP_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function urlset(rows: { loc: string; changefreq?: string; priority?: number }[]): string {
  const body = rows
    .map(
      (r) =>
        `<url><loc>${esc(r.loc)}</loc>${r.changefreq ? `<changefreq>${r.changefreq}</changefreq>` : ""}${
          r.priority != null ? `<priority>${r.priority}</priority>` : ""
        }</url>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function sitemapIndex(paths: string[]): string {
  const body = paths.map((p) => `<sitemap><loc>${esc(`${SITE_URL}${p}`)}</loc></sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

/** Start of today (UTC): the "upcoming" cut-off, stable for a day so caches agree. */
export const todayIso = () => `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
