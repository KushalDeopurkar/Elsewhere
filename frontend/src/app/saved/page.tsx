import type { Metadata } from "next";
import SavedView from "@/components/SavedView";
import SiteFooter from "@/components/SiteFooter";
import { PageHeader } from "@/components/Section";

export const metadata: Metadata = { title: "Saved events - EventEngine" };

export default function SavedPage() {
  return (
    <>
      <PageHeader
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
