import type { Metadata } from "next";
import PassportView from "@/components/PassportView";
import SiteFooter from "@/components/SiteFooter";
import { PageHeader } from "@/components/Section";

export const metadata: Metadata = { title: "Your passport - Elsewhere" };

export default function PassportPage() {
  return (
    <>
      <PageHeader
        title="Your passport"
        lede="A stamp for every kind of event you explore, and badges for the milestones. Kept on this device."
        crumbs={[{ label: "Home", href: "/" }, { label: "Passport" }]}
      />
      <div className="shell">
        <PassportView />
      </div>
      <SiteFooter />
    </>
  );
}
