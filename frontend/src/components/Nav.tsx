"use client";

import TransitionLink from "./TransitionLink";
import { usePathname } from "next/navigation";
import { Compass, MapTrifold, BookmarkSimple, MagnifyingGlass, UserCircle } from "@phosphor-icons/react/ssr";
import BrandMark from "./BrandMark";
import LocationSelector from "./LocationSelector";
import AccountButton from "./AccountButton";
import CityClock from "./CityClock";
import { useSaved } from "@/lib/saved";

// Three doors, numbered like platforms: Discover (what is on, and ask for
// anything), Explore (every listing, filtered) and Map. Saved, search and your account sit on
// the right; on phones the same band becomes the bottom tab bar.
const LINKS = [
  { href: "/", label: "Discover", n: "01" },
  { href: "/explore", label: "Explore", n: "02" },
  { href: "/map", label: "Map", n: "03" },
];

const TABS = [
  { href: "/", label: "Discover", icon: Compass },
  { href: "/explore", label: "Explore", icon: MagnifyingGlass },
  { href: "/map", label: "Map", icon: MapTrifold },
  { href: "/saved", label: "Saved", icon: BookmarkSimple },
  { href: "/me", label: "You", icon: UserCircle },
];

function active(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const pathname = usePathname();
  const savedCount = useSaved().length;

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <nav className="topnav" aria-label="Main">
        <div className="shell topnav-inner">
          <TransitionLink href="/" className="brand" aria-label="Elsewhere home">
            <BrandMark className="brand-mark" />
            <span className="brand-word">Elsewhere</span>
          </TransitionLink>

          <div className="topnav-links">
            {LINKS.map(({ href, label, n }) => (
              <TransitionLink
                key={href}
                href={href}
                className="topnav-link"
                aria-current={active(pathname, href) ? "page" : undefined}
              >
                <span className="topnav-n" aria-hidden="true">
                  {n}
                </span>
                {label}
              </TransitionLink>
            ))}
          </div>

          <div className="topnav-end">
            <div className="topnav-city">
              <LocationSelector />
              <CityClock className="topnav-clock" />
            </div>
            <TransitionLink href="/explore?focus=1" className="icon-btn" aria-label="Search events">
              <MagnifyingGlass size={18} weight="bold" />
            </TransitionLink>
            <TransitionLink
              href="/saved"
              className="icon-btn topnav-saved"
              aria-label={`Saved events${savedCount ? `, ${savedCount}` : ""}`}
              aria-current={active(pathname, "/saved") ? "page" : undefined}
            >
              <BookmarkSimple size={18} weight={active(pathname, "/saved") ? "fill" : "bold"} />
              {savedCount > 0 && <span className="count-dot">{savedCount > 99 ? "99+" : savedCount}</span>}
            </TransitionLink>
            <AccountButton />
          </div>
        </div>
      </nav>

      {/* On an event page the phone's bottom edge belongs to the event's own
          action bar (price, going, tickets); the header still leads home. */}
      <nav className={`tabbar${pathname.startsWith("/events/") ? " is-off" : ""}`} aria-label="Sections">
        {TABS.map(({ href, label, icon: Icon }) => {
          const on = active(pathname, href);
          return (
            <TransitionLink key={href} href={href} className="tab" aria-current={on ? "page" : undefined}>
              <Icon size={22} weight={on ? "fill" : "regular"} aria-hidden="true" />
              <span>{label}</span>
              {href === "/saved" && savedCount > 0 && <span className="count-dot is-tab">{savedCount}</span>}
            </TransitionLink>
          );
        })}
      </nav>
    </>
  );
}
