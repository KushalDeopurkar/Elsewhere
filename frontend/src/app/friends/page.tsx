import type { Metadata } from "next";
import FriendsView from "@/components/FriendsView";
import SiteFooter from "@/components/SiteFooter";
import { PAGE_LINES, PageHeader, lineColor } from "@/components/Section";

export const metadata: Metadata = { title: "Friends - Elsewhere" };

export default function FriendsPage() {
  return (
    <>
      <PageHeader
        line={lineColor(PAGE_LINES.friends)}
        posters
        title="Friends"
        lede="Follow people you go out with. When you follow each other, you see each other's plans."
        crumbs={[{ label: "Home", href: "/" }, { label: "Friends" }]}
      />
      <div className="shell">
        <FriendsView />
      </div>
      <SiteFooter />
    </>
  );
}
