import type { Metadata } from "next";
import SavedView from "@/components/SavedView";

export const metadata: Metadata = {
  title: "Saved events — EventEngine",
  description: "Events you've saved in this browser.",
};

export default function SavedPage() {
  return <SavedView />;
}
