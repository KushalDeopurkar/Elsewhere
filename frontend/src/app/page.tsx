"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapTrifold, Sparkle } from "@phosphor-icons/react/ssr";
import SearchBar from "@/components/SearchBar";
import { TimeRail, CategoryRail, TimeWindow } from "@/components/FilterRail";
import EventGrid from "@/components/EventGrid";
import SiteFooter from "@/components/SiteFooter";
import HeroDeck from "@/components/HeroDeck";
import { useEvents } from "@/hooks/useEvents";
import { EventCategory } from "@/lib/types";
import { matchesWindow } from "@/lib/formatDate";
import { DEMO_CITIES } from "@/lib/demoEvents";

export default function Home() {
  const { events, loading, error, isSample, search, retry } = useEvents({
    limit: 48,
  });

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [when, setWhen] = useState<TimeWindow>("any");
  const [city, setCity] = useState<string>(DEMO_CITIES[0]);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(
      () => search({ q: query || undefined, category: category || undefined }),
      query ? 350 : 0,
    );
    return () => clearTimeout(id);
  }, [query, category, search]);

  // The date window and city are applied client-side: the search endpoint
  // takes neither, and re-filtering a loaded page beats a round trip.
  const visible = useMemo(
    () =>
      events.filter(
        (e) =>
          matchesWindow(e.start_time, when) &&
          (isSample ? e.city === city : true),
      ),
    [events, when, city, isSample],
  );

  const filtered = Boolean(query || category) || when !== "any";
  const feature = visible.slice(0, 3);
  const rest = filtered ? visible : visible.slice(3);

  const clearAll = () => {
    setQuery("");
    setCategory(null);
    setWhen("any");
  };

  return (
    <>
      <section className="shell hero">
        <div className="hero-glow" aria-hidden="true" />

        <div className="hero-body">
          <label className="hero-city">
            Events in
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-label="Choose a city"
            >
              {DEMO_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <h1 className="hero-title">
            Your city is up to
            <br />
            something <em>tonight</em>.
          </h1>

          <p className="lede">
            Gigs, comedy, food pop-ups and night treks across Mumbai, Bengaluru
            and Delhi, gathered from across the web and mapped.
          </p>

          <SearchBar value={query} onChange={setQuery} />

          <Link href="/map" className="section-link">
            <MapTrifold size={17} weight="duotone" />
            See it on the map
            <ArrowRight size={14} weight="bold" />
          </Link>
        </div>

        <HeroDeck events={events} />
      </section>

      <div className="shell" style={{ display: "grid", gap: "0.75rem" }}>
        <TimeRail value={when} onChange={setWhen} />
        <CategoryRail value={category} onChange={setCategory} />
      </div>

      {!filtered && (feature.length === 3 || loading) && (
        <section className="shell section">
          <div className="section-head">
            <h2>Happening this week</h2>
            {isSample && (
              <span className="sample-note">
                <Sparkle size={13} weight="fill" />
                Sample data, the API is not connected
              </span>
            )}
          </div>
          <EventGrid
            events={feature}
            loading={loading}
            variant="feature"
            skeletonCount={3}
          />
        </section>
      )}

      <section className="shell section" style={{ paddingTop: filtered ? undefined : 0 }}>
        <div className="section-head">
          <h2>{filtered ? "Matching events" : "Everything else"}</h2>
          {!loading && !error && visible.length > 0 && (
            <span className="section-link mono">
              {visible.length} event{visible.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <EventGrid
          events={rest}
          loading={loading}
          error={error}
          onRetry={retry}
          onClear={filtered ? clearAll : undefined}
        />
      </section>

      <SiteFooter />
    </>
  );
}
