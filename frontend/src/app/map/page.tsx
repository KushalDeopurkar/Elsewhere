import type { Metadata } from "next";
import MapView from "@/components/MapView";

export const metadata: Metadata = {
  title: "Map — EventEngine",
  description: "Browse events by location on an interactive map.",
};

export default function MapPage() {
  return <MapView />;
}
