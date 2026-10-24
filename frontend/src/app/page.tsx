"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapTrifold, Sparkle } from "@phosphor-icons/react/ssr";
import SearchBar from "@/components/SearchBar";
import { TimeRail, CategoryRail, TimeWindow } from "@/components/FilterRail";
import EventGrid from "@/components/EventGrid";
import HeroDeck from "@/components/HeroDeck";
import IntentResults from "@/components/IntentResults";
import SiteFooter from "@/components/SiteFooter";
import { useEvents } from "@/hooks/useEvents";
import { EventCategory } from "@/lib/types";
import { matchesWindow } from "@/lib/formatDate";
import { DEMO_CITIES } from "@/lib/demoEvents";
import {
  Intent,
  Signal,
  parseIntent,
  dropSignal,
  EXAMPLE_PROMPTS,
} from "@/lib/intent";

export default function Home() {
  // The whole upcoming pool is fetched once and narrowed in the browser.
  // Intent discovery scores across categories, which the search endpoint
  // cannot do in one call: it takes a single category. With a large live
  // database this should become a fan-out of one request per inferred
  // category, merged server-side.
  const { events, loading, error, isSample, retry } = useEvents({ limit: 100 });

  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [when, setWhen] = useState<TimeWindow>("any");
  const [city, setCity] = useState<string>(DEMO_CITIES[0]);

  const runIntent = (text: string) => {
    const trimmed = text.trim();
    setIntent(trimmed ? parseIntent(trimmed) : null);
  };

  const browse = useMemo(
    () =>
      events.filter(
        (e) =>
          matchesWindow(e.start_time, when) &&
          (!category || e.category === category) &&
          (isSample ? e.city === city : true),
      ),
    [events, when, category, city, isSample],
  );

  const filtered = Boolean(category) || when !== "any";
  const feature = browse.slice(0, 3);
  const rest = filtered ? browse : browse.slice(3);

  const clearAll = () => {
    setQuery("");
    setIntent(null);
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
            What is worth
            <br />
            <em>showing up</em> for?
          </h1>

          <p className="lede">
            Describe what you want to learn, build, watch or join. EventEngine
            reads it and finds matching events across every category.
          </p>

          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={() => runIntent(query)}
            placeholder="Learn AI, meet founders, this weekend"
          />

          <div className="prompt-row">
            {EXAMPLE_PROMPTS.slice(0, 3).map((p) => (
              <button
                key={p}
                type="button"
                className="prompt"
                onClick={() => {
                  setQuery(p);
                  runIntent(p);
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <Link href="/map" className="section-link">
            <MapTrifold size={17} weight="duotone" />
            See it on the map
            <ArrowRight size={14} weight="bold" />
          </Link>
        </div>

        <HeroDeck events={events} />
      </section>

      {intent ? (
        <IntentResults
          intent={intent}
          events={events}
          loading={loading}
          isSample={isSample}
          onDropSignal={(s: Signal) => setIntent(dropSignal(intent, s))}
          onClear={clearAll}
        />
      ) : (
        <>
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
                    Demo data, the live API is not connected
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

          <section
            className="shell section"
            style={{ paddingTop: filtered ? undefined : 0 }}
          >
            <div className="section-head">
              <h2>{filtered ? "Matching events" : "Everything else"}</h2>
              {!loading && !error && browse.length > 0 && (
                <span className="section-link mono">
                  {browse.length} event{browse.length === 1 ? "" : "s"}
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
        </>
      )}

      <SiteFooter />
    </>
  );
}
