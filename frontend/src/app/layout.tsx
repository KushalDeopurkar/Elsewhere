import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Pulse - what is on near you tonight",
  description:
    "Gigs, comedy, food pop-ups and night treks across Mumbai, Bengaluru and Delhi, gathered from across the web and mapped.",
};

export const viewport: Viewport = {
  themeColor: "#181411",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
