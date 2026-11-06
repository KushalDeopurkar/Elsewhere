import type { Metadata } from "next";
import CategoriesGrid from "@/components/CategoriesGrid";
import SiteFooter from "@/components/SiteFooter";
import { PageHeader } from "@/components/Section";

export const metadata: Metadata = {
  title: "Categories - EventEngine",
  description: "Technology, startups, workshops, arts, sports, music, food, wellness, outdoors and more.",
};

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        title="Every kind of event"
        lede="From hackathons and founder meetups to half marathons, gallery openings and food festivals."
        crumbs={[{ label: "Home", href: "/" }, { label: "Categories" }]}
      />
      <section className="shell sec-tight">
        <CategoriesGrid />
      </section>
      <SiteFooter />
    </>
  );
}
