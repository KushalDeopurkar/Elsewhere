"use client";

import TransitionLink from "./TransitionLink";
import { usePathname } from "next/navigation";
import {
  House,
  Compass,
  SquaresFour,
  MapTrifold,
  Sparkle,
  BookmarkSimple,
  MagnifyingGlass,
  Cards,
  Smiley,
  Play,
} from "@phosphor-icons/react/ssr";
import BrandMark from "./BrandMark";
import LocationSelector from "./LocationSelector";
import { useSaved } from "@/lib/saved";

const LINKS = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/discover", label: "Discover", icon: Cards },
  { href: "/vibe", label: "Vibe", icon: Smiley },
  { href: "/feed", label: "Feed", icon: Play },
  { href: "/categories", label: "Categories", icon: SquaresFour },
  { href: "/map", label: "Map", icon: MapTrifold },
  { href: "/plan-my-day", label: "Plan My Day", icon: Sparkle },
];

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/plan-my-day", label: "Plan", icon: Sparkle },
  { href: "/discover", label: "Swipe", icon: Cards },
  { href: "/saved", label: "Saved", icon: BookmarkSimple },
];

function active(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const pathname = usePathname();
  const savedCount = useSaved().length;

  return (
    <>
      <nav className="topnav" aria-label="Main">
        <div className="shell topnav-inner">
          <TransitionLink href="/" className="brand" aria-label="Elsewhere home">
            <BrandMark className="brand-mark" />
            <span>Elsewhere</span>
          </TransitionLink>

          <div className="topnav-links">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <TransitionLink
                key={href}
                href={href}
                className={`topnav-link${href === "/plan-my-day" ? " is-ai" : ""}`}
                aria-current={active(pathname, href) ? "page" : undefined}
              >
                <Icon size={16} weight={active(pathname, href) ? "fill" : "bold"} aria-hidden="true" />
                {label}
              </TransitionLink>
            ))}
          </div>

          <div className="topnav-end">
            <LocationSelector />
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
          </div>
        </div>
      </nav>

      <nav className="tabbar" aria-label="Sections">
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
