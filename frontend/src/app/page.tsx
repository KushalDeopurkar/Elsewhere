"use client";

import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import CategoryFilter from "@/components/CategoryFilter";
import EventList from "@/components/EventList";
import { useEvents } from "@/hooks/useEvents";
import { EventCategory } from "@/lib/types";

export default function Home() {
  const { events, loading, error, search, retry } = useEvents({ limit: 30 });
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | null>(null);

  const handleSearch = (query: string) => {
    search({ q: query || undefined });
  };

  const handleCategorySelect = (category: EventCategory | null) => {
    setSelectedCategory(category);
    search({ category: category || undefined });
  };

  return (
    <div className="container-page">
      <section className="hero">
        <div className="hero-search-col">
          <h1 className="hero-heading">What&apos;s happening near you</h1>
          <p className="hero-sub">
            Search thousands of concerts, meetups, markets, and more — filtered
            by what you care about, near where you are.
          </p>
        </div>
        <div className="hero-search-col">
          <SearchBar onSearch={handleSearch} />
        </div>
      </section>

      <div style={{ marginBottom: "2rem" }}>
        <CategoryFilter selected={selectedCategory} onSelect={handleCategorySelect} />
      </div>

      <div style={{ paddingBottom: "4rem" }}>
        <EventList events={events} loading={loading} error={error} onRetry={retry} />
      </div>
    </div>
  );
}
