import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AlertAction from "@/components/AlertAction";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Your alert - Elsewhere",
  robots: { index: false },
};

export default async function AlertPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; token?: string }>;
}) {
  const { action, token } = await searchParams;
  // Opened without the link's token (from a bookmark, or typed): explain alerts instead.
  if (!token) redirect("/alerts");
  return (
    <>
      <section className="shell section alert-page">
        <AlertAction action={action === "unsubscribe" ? "unsubscribe" : "confirm"} token={token ?? ""} />
      </section>
      <SiteFooter />
    </>
  );
}
