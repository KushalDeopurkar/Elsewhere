import type { Metadata } from "next";
import SettingsView from "@/components/SettingsView";
import SiteFooter from "@/components/SiteFooter";
import { PageHeader } from "@/components/Section";
import ThemeSettings from "@/components/ThemeSettings";

export const metadata: Metadata = { title: "Settings - Elsewhere" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" crumbs={[{ label: "Home", href: "/" }, { label: "Settings" }]} />
      <div className="shell st-page">
        <ThemeSettings />
        <section className="st-profile" aria-labelledby="st-profile-h">
          <h2 id="st-profile-h" className="st-legend">
            Profile
          </h2>
          <SettingsView />
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
