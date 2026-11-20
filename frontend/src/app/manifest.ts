import type { MetadataRoute } from "next";

/** Makes the site installable ("Add to Home Screen"), which iPhones need before they allow notifications. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elsewhere",
    short_name: "Elsewhere",
    description: "Be elsewhere tonight: every kind of event in your city, from gigs and matches to workshops and meetups.",
    id: "/",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#0e1015",
    theme_color: "#0e1015",
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
