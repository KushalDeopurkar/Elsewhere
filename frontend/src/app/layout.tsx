import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/instrument-serif/400.css";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "EventEngine — find your next thing",
  description:
    "Search hackathons, exhibitions, matches, workshops, concerts and community events by date, category and distance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
