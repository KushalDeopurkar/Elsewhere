"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSavedEvents } from "@/lib/savedEvents";
import { BookmarkIcon, MapIcon, MenuIcon, CloseIcon } from "./icons";

const NAV = [
  { href: "/", label: "Discover" },
  { href: "/map", label: "Map" },
  { href: "/saved", label: "Saved" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const { count, ready } = useSavedEvents();

  // Close the mobile sheet on navigation so it never lingers over a new page.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="masthead">
      <div className="shell masthead-inner">
        <Link href="/" className="wordmark" aria-label="EventEngine — home">
          EventEngine<span className="wordmark-dot">.</span>
        </Link>

        <nav className="masthead-nav" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="masthead-link"
              aria-current={isCurrent(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="masthead-actions">
          <Link
            href="/map"
            className="button button-quiet"
            aria-label="Open map view"
            style={{ gap: "0.4375rem" }}
          >
            <MapIcon size={15} />
            <span className="map-label">Map</span>
          </Link>
          <Link
            href="/saved"
            className="button"
            aria-label={
              ready && count > 0 ? `Saved events (${count})` : "Saved events"
            }
          >
            <BookmarkIcon size={15} />
            {ready && count > 0 && <span className="saved-count">{count}</span>}
          </Link>
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon size={18} /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="mobile-nav" id="mobile-nav" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? "page" : undefined}
            >
              {item.label}
              {item.href === "/saved" && ready && count > 0 && (
                <span className="saved-count">{count}</span>
              )}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
