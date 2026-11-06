import type { Metadata } from "next";
import { Sparkle } from "@phosphor-icons/react/ssr";
import PlanMyDayView from "@/components/PlanMyDayView";
import SiteFooter from "@/components/SiteFooter";
import { PageHeader } from "@/components/Section";

export const metadata: Metadata = {
  title: "Plan my day with AI - EventEngine",
  description: "Describe your day and get real events in an order you can make, with the route on a map.",
};

export default function PlanMyDayPage() {
  return (
    <>
      <PageHeader
        title={<><Sparkle size={34} weight="fill" className="title-spark" /> Plan my day</>}
        lede="Tell it the day you want. It picks real upcoming events, orders them so you can make each one, and maps the route."
        crumbs={[{ label: "Home", href: "/" }, { label: "Plan my day" }]}
      />
      <PlanMyDayView />
      <SiteFooter />
    </>
  );
}
