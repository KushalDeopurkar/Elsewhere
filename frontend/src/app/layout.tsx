import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import "./redesign.css";
import Nav from "@/components/Nav";
import RouteSignal from "@/components/RouteSignal";
import CursorLayer from "@/components/CursorLayer";
import PassportToast from "@/components/PassportToast";
import SocialRoot from "@/components/SocialRoot";
import GradeChip from "@/components/GradeChip";
import { GRADE_BOOT } from "@/lib/gradeBoot";

export const metadata: Metadata = {
  title: "Elsewhere - discover what is happening",
  description:
    "Hackathons, workshops, matches, exhibitions and meetups across every category, gathered from across the web and mapped.",
};

export const viewport: Viewport = {
  themeColor: "#0e1015",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: GRADE_BOOT }} />
        <RouteSignal />
        <Nav />
        <main>{children}</main>
        <PassportToast />
        <SocialRoot />
        <GradeChip />
        <CursorLayer />
      </body>
    </html>
  );
}
