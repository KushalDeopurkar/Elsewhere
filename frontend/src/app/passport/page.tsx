import type { Metadata } from "next";
import PassportView from "@/components/PassportView";
import SiteFooter from "@/components/SiteFooter";
import { PAGE_LINES, PageHeader, lineColor } from "@/components/Section";

export const metadata: Metadata = { title: "Your passport - Elsewhere" };

export default function PassportPage() {
  return (
    <>
      <PageHeader
        line={lineColor(PAGE_LINES.passport)}
        posters
        title="Your passport"
        lede="A stamp for every kind of event you explore, and badges for the milestones. Saved to your account when you're signed in, and on this device otherwise."
        crumbs={[{ label: "Home", href: "/" }, { label: "Passport" }]}
      />
      <div className="shell">
        <PassportView />
      </div>
      <SiteFooter />
    </>
  );
}
