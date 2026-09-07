import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "EventEngine — What's happening near you",
  description: "Search and discover events happening around you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="site-nav">
          <div className="container-page site-nav-inner">
            <Link href="/" className="brand">
              EventEngine
            </Link>
            <div className="nav-links">
              <Link href="/" className="nav-link">
                Browse
              </Link>
              <Link href="/map" className="nav-link">
                Map
              </Link>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
