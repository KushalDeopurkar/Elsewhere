import Link from "next/link";
import BrandMark from "./BrandMark";

const GROUPS = [
  {
    title: "Find",
    links: [
      { href: "/", label: "Discover" },
      { href: "/explore", label: "Explore" },
      { href: "/map", label: "Map" },
      { href: "/plan-my-day", label: "Plan my day" },
    ],
  },
  {
    title: "Keep",
    links: [
      { href: "/saved", label: "Saved" },
      { href: "/passport", label: "Passport" },
      { href: "/recap", label: "Monthly recap" },
      { href: "/alerts", label: "Alerts" },
    ],
  },
  {
    title: "You",
    links: [
      { href: "/me", label: "Your page" },
      { href: "/friends", label: "Friends" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

/** The back of the timetable: every door in the site, and where the listings come from. */
export default function SiteFooter() {
  return (
    <footer className="foot">
      <div className="shell foot-inner">
        <div className="foot-brand">
          <p className="foot-word">
            <BrandMark className="foot-mark" />
            Elsewhere
          </p>
          <p className="foot-tagline">Somewhere better to be.</p>
          <p className="foot-note">
            Listings gathered every six hours from public sources: ticketing sites, community calendars and city open data.
            Times are local to each city. Always check the organiser&apos;s page before you go.
          </p>
        </div>
        {GROUPS.map((g) => (
          <nav key={g.title} className="foot-col" aria-label={g.title}>
            <p className="foot-title">{g.title}</p>
            <ul>
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="foot-legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
