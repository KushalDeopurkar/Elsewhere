import type { Metadata } from "next";
import PollView from "@/components/PollView";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Which one? - Elsewhere",
  description: "Vote on where the group goes. No account needed.",
  robots: { index: false },
};

export default async function PollPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: fresh } = await searchParams;
  return (
    <>
      <div className="shell">
        <PollView id={id} fresh={fresh === "1"} />
      </div>
      <SiteFooter />
    </>
  );
}
