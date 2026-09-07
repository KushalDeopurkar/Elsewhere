"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import CategoryFilter from "@/components/CategoryFilter";
import { EventCategory } from "@/lib/types";

// Leaflet touches window/document at import time, so the map must never be
// part of the server render.
const EventMap = dynamic(() => import("@/components/EventMap"), {
  ssr: false,
  loading: () => (
    <div className="map-loading-fallback">
      <span className="map-status-spinner" aria-hidden="true" />
      Loading map&hellip;
    </div>
  ),
});

export default function MapPage() {
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | null>(null);

  return (
    <div className="map-page">
      <div className="map-filter-bar">
        <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} />
      </div>
      <div className="map-stage">
        <EventMap category={selectedCategory} />
      </div>
    </div>
  );
}
