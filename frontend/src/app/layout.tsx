import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./tokens.css";
import "./globals.css";
import "./redesign.css";
import "./core.css";
import Nav from "@/components/Nav";
import RouteSignal from "@/components/RouteSignal";
import SocialRoot from "@/components/SocialRoot";
import CityGuess from "@/components/CityGuess";
import AppRoot from "@/components/AppRoot";
import ThemeSync from "@/components/ThemeSync";
import { themeBootScript } from "@/lib/theme";
import { IMAGE_PROXY_ORIGIN } from "@/lib/imageUrl";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Elsewhere - discover what is happening",
  description:
    "Hackathons, workshops, matches, exhibitions and meetups across every category, gathered from across the web and mapped.",
  openGraph: { siteName: "Elsewhere", type: "website" },
  applicationName: "Elsewhere",
  appleWebApp: { capable: true, title: "Elsewhere", statusBarStyle: "black" },
  // Google Search Console ownership check (the "HTML tag" method): set
  // GOOGLE_SITE_VERIFICATION in Vercel to the content="…" value Google shows.
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#10172b" },
  ],
  colorScheme: "light dark",
};

// Vercel Web Analytics and Speed Insights: cookieless page views and real
// loading times. Only on Vercel deployments, where these script paths exist.
const ON_VERCEL = process.env.VERCEL === "1";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" data-theme="day" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
      </head>
      <body>
        {IMAGE_PROXY_ORIGIN && <link rel="preconnect" href={IMAGE_PROXY_ORIGIN} />}
        <RouteSignal />
        <Nav />
        <main id="main">{children}</main>
        <SocialRoot />
        <CityGuess />
        <AppRoot />
        <ThemeSync />
        {ON_VERCEL && (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: "window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};",
              }}
            />
            <script defer src="/_vercel/insights/script.js" />
            <script defer src="/_vercel/speed-insights/script.js" />
          </>
        )}
      </body>
    </html>
  );
}
