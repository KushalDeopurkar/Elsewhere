"use client";

import TransitionLink from "./TransitionLink";
import { usePathname } from "next/navigation";
import { Compass, MapTrifold, BookmarkSimple, MagnifyingGlass, Ticket, UserCircle } from "@phosphor-icons/react/ssr";
import BrandMark from "./BrandMark";
import LocationSelector from "./LocationSelector";
import AccountButton from "./AccountButton";
import { useSaved } from "@/lib/saved";

// Few, strong doors: tonight, explore, map. Saved, search and your account
// sit on the right as icons.
const LINKS = [
  { href: "/", label: "Tonight", icon: Ticket },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/map", label: "Map", icon: MapTrifold },
];

const TABS = [
  { href: "/", label: "Tonight", icon: Ticket },
  { href: "/explore", label: "Explore", icon: Compass },
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
                className="topnav-link"
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
            <AccountButton />
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
