import type { Metadata } from "next";
import SwipeDeck from "@/components/SwipeDeck";
import "./discover.css";

export const metadata: Metadata = {
  title: "Discover - Elsewhere",
  description: "Swipe through events near you. Save what you like and the deck learns your taste.",
};

export default function DiscoverPage() {
  return <SwipeDeck />;
}
