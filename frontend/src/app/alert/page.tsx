import type { Metadata } from "next";
import AlertAction from "@/components/AlertAction";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Your alert - EventEngine",
  robots: { index: false },
};

export default async function AlertPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; token?: string }>;
}) {
  const { action, token } = await searchParams;
  return (
    <>
      <section className="shell section alert-page">
        <AlertAction action={action === "unsubscribe" ? "unsubscribe" : "confirm"} token={token ?? ""} />
      </section>
      <SiteFooter />
    </>
  );
}
