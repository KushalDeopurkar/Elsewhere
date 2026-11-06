import { Suspense } from "react";
import type { Metadata } from "next";
import ExploreView from "@/components/ExploreView";
import SiteFooter from "@/components/SiteFooter";
import { PageHeader } from "@/components/Section";

export const metadata: Metadata = {
  title: "Explore events - EventEngine",
  description: "Search every upcoming event near you by meaning, and filter by category, date and price.",
};

export default function ExplorePage() {
  return (
    <>
      <PageHeader
        title="Explore"
        lede="Every upcoming event near you. Describe what you want in plain words, then narrow it down."
        crumbs={[{ label: "Home", href: "/" }, { label: "Explore" }]}
      />
      <Suspense fallback={<div className="shell explore-fallback" />}>
        <ExploreView />
      </Suspense>
      <SiteFooter />
    </>
  );
}
