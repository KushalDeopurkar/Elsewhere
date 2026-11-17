import type { Metadata } from "next";
import ListView from "@/components/ListView";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = { title: "List - Elsewhere" };

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div className="shell">
        <ListView id={id} />
      </div>
      <SiteFooter />
    </>
  );
}
