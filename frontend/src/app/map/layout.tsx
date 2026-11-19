import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Map - Elsewhere",
  description: "Every upcoming event in your city on one map, with a timeline to see what's on at any hour.",
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
