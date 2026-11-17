import { Suspense } from "react";
import type { Metadata } from "next";
import VibeView from "@/components/VibeView";
import SiteFooter from "@/components/SiteFooter";
import "./vibe.css";

export const metadata: Metadata = {
  title: "Pick a vibe - Elsewhere",
  description: "Choose a mood, set your budget and distance, and watch matching events near you rearrange live.",
};

export default function VibePage() {
  return (
    <>
      <Suspense fallback={<main className="vibe" />}>
        <VibeView />
      </Suspense>
      <SiteFooter />
    </>
  );
}
