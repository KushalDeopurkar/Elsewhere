"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Compass,
  SquaresFour,
  MapTrifold,
  Sparkle,
  BookmarkSimple,
  MagnifyingGlass,
} from "@phosphor-icons/react/ssr";
import BrandMark from "./BrandMark";
import LocationSelector from "./LocationSelector";
import { useSaved } from "@/lib/saved";

const LINKS = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/categories", label: "Categories", icon: SquaresFour },
  { href: "/map", label: "Map", icon: MapTrifold },
  { href: "/plan-my-day", label: "Plan My Day", icon: Sparkle },
];

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/plan-my-day", label: "Plan", icon: Sparkle },
  { href: "/map", label: "Map", icon: MapTrifold },
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
          <Link href="/" className="brand" aria-label="EventEngine home">
            <BrandMark className="brand-mark" />
            <span>EventEngine</span>
          </Link>

          <div className="topnav-links">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`topnav-link${href === "/plan-my-day" ? " is-ai" : ""}`}
                aria-current={active(pathname, href) ? "page" : undefined}
              >
                <Icon size={16} weight={active(pathname, href) ? "fill" : "bold"} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>

          <div className="topnav-end">
            <LocationSelector />
            <Link href="/explore?focus=1" className="icon-btn" aria-label="Search events">
              <MagnifyingGlass size={18} weight="bold" />
            </Link>
            <Link
              href="/saved"
              className="icon-btn topnav-saved"
              aria-label={`Saved events${savedCount ? `, ${savedCount}` : ""}`}
              aria-current={active(pathname, "/saved") ? "page" : undefined}
            >
              <BookmarkSimple size={18} weight={active(pathname, "/saved") ? "fill" : "bold"} />
              {savedCount > 0 && <span className="count-dot">{savedCount > 99 ? "99+" : savedCount}</span>}
            </Link>
          </div>
        </div>
      </nav>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map(({ href, label, icon: Icon }) => {
          const on = active(pathname, href);
          return (
            <Link key={href} href={href} className="tab" aria-current={on ? "page" : undefined}>
              <Icon size={22} weight={on ? "fill" : "regular"} aria-hidden="true" />
              <span>{label}</span>
              {href === "/saved" && savedCount > 0 && <span className="count-dot is-tab">{savedCount}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
