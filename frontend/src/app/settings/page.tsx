import type { Metadata } from "next";
import SettingsView from "@/components/SettingsView";
import SiteFooter from "@/components/SiteFooter";
import { PageHeader } from "@/components/Section";

export const metadata: Metadata = { title: "Edit profile - Elsewhere" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Edit profile" crumbs={[{ label: "Home", href: "/" }, { label: "Edit profile" }]} />
      <div className="shell">
        <SettingsView />
      </div>
      <SiteFooter />
    </>
  );
}
