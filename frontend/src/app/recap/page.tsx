import type { Metadata } from "next";
import RecapView from "@/components/RecapView";

export const metadata: Metadata = { title: "Your month in Elsewhere" };

export default function RecapPage() {
  return <RecapView />;
}
