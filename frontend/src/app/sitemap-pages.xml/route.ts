import { CATEGORY_PAGES } from "@/lib/categoryPages";
import { SITE_URL } from "@/lib/site";
import { SITEMAP_HEADERS, urlset } from "@/lib/sitemapXml";

export const dynamic = "force-static";

export function GET() {
  const rows = [
    { loc: `${SITE_URL}/`, changefreq: "hourly", priority: 1 },
    { loc: `${SITE_URL}/explore`, changefreq: "hourly", priority: 0.8 },
    { loc: `${SITE_URL}/map`, changefreq: "daily", priority: 0.6 },
    { loc: `${SITE_URL}/plan-my-day`, changefreq: "weekly", priority: 0.4 },
    { loc: `${SITE_URL}/alerts`, changefreq: "monthly", priority: 0.3 },
    { loc: `${SITE_URL}/privacy`, changefreq: "yearly", priority: 0.1 },
    { loc: `${SITE_URL}/terms`, changefreq: "yearly", priority: 0.1 },
    ...CATEGORY_PAGES.map((c) => ({ loc: `${SITE_URL}/categories/${c.slug}`, changefreq: "daily", priority: 0.7 })),
  ];
  return new Response(urlset(rows), { headers: SITEMAP_HEADERS });
}
