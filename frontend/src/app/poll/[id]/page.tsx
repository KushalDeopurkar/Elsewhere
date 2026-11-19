import type { Metadata } from "next";
import PollView from "@/components/PollView";
import SiteFooter from "@/components/SiteFooter";
import { pollPreview } from "@/lib/pollServer";

// The link preview: "Asha asks: Friday night, which one?" with the options.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await pollPreview(id);
  const title = p ? `${p.who} asks: ${p.title}` : "Which one? - Elsewhere";
  const options = p?.events.map((e, i) => `${String.fromCharCode(65 + i)}) ${e.title}`).join("  ");
  const description = p
    ? p.decided
      ? `Decided. ${options}`
      : `Vote on where the group goes. ${options}. No account needed.`
    : "Vote on where the group goes. No account needed.";
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: "website", siteName: "Elsewhere" },
    twitter: { card: "summary_large_image", title, description },
  };
}

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
