import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Personal pages, polls (shared by link only) and the API.
      disallow: ["/api/", "/auth/", "/settings", "/me", "/friends", "/saved", "/poll/", "/recap", "/passport", "/alert"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
