"use client";

import { usePathname } from "next/navigation";

export default function SiteFooter() {
  const pathname = usePathname();

  // The map is a full-viewport application view: its own height is
  // calc(100dvh - header), so appending a footer below it would make the
  // page scroll and cut off the map.
  if (pathname.startsWith("/map")) return null;

  return (
    <footer className="footer">
      <div className="shell footer-inner">
        <span className="wordmark" aria-hidden="true">
          EventEngine<span className="wordmark-dot">.</span>
        </span>
        <p className="footer-note">
          Events are gathered from public listings and refreshed on a schedule,
          so coverage varies by city and category. Saved events are stored in
          this browser only.
        </p>
      </div>
    </footer>
  );
}
