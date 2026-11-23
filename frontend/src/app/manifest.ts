import type { MetadataRoute } from "next";

/** Makes the site installable ("Add to Home Screen"), which iPhones need before they allow notifications. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elsewhere",
    short_name: "Elsewhere",
    description: "Somewhere better to be: every kind of event in your city, from workshops and matches to gigs and meetups.",
    id: "/",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#0a152a",
    theme_color: "#0a152a",
    categories: ["entertainment", "lifestyle", "events"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Discover", url: "/?source=app" },
      { name: "Map", url: "/map" },
      { name: "Saved", url: "/saved" },
    ],
  };
}
