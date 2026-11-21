import type { Metadata } from "next";
import SavedView from "@/components/SavedView";
import SiteFooter from "@/components/SiteFooter";
import { PAGE_LINES, PageHeader, lineColor } from "@/components/Section";

export const metadata: Metadata = { title: "Saved events - Elsewhere" };

export default function SavedPage() {
  return (
    <>
      <PageHeader
        line={lineColor(PAGE_LINES.saved)}
        posters
        title="Saved events"
        lede="Everything you bookmarked, soonest first."
        crumbs={[{ label: "Home", href: "/" }, { label: "Saved" }]}
      />
      <div className="shell">
        <SavedView />
      </div>
      <SiteFooter />
    </>
  );
}
