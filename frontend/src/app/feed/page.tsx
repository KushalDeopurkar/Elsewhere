import type { Metadata } from "next";
import FeedView from "@/components/FeedView";
import "./feed.css";

export const metadata: Metadata = {
  title: "Feed - Elsewhere",
  description: "Scroll through events near you, one full screen at a time. The feed tunes itself to what you stop on.",
};

export default function FeedPage() {
  return <FeedView />;
}
