"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { EMPTY_FILTERS, resolveDay } from "@/lib/filters";
import { Event, EventCategory } from "@/lib/types";
import { TAXONOMY } from "@/lib/taxonomy";
import { getCategoryPaint } from "@/lib/categoryColors";
import { formatDayOnly } from "@/lib/formatDate";
import { ArrowRightIcon, PinIcon } from "./icons";
import DateStrip from "./DateStrip";
import SearchConsole from "./SearchConsole";

// Leaflet touches window/document at import time, so the map must never be
// part of the server render.
const EventMap = dynamic(() => import("./EventMap"), {
  ssr: false,
  loading: () => (
    <div className="map-fallback">
      <span className="spinner" aria-hidden="true" />
      Loading map…
    </div>
  ),
});

/**
 * Map discovery.
 *
 * The map and the list are two views of one result set: whatever is in the
 * current viewport. Selecting in either highlights in both, which is what
 * makes the map answer "what's around here" rather than just plotting dots.
 *
 * Only the enum category is filtered here, not the full taxonomy — the
 * bounds endpoint takes a category but no keyword, so offering keyword
 * subcategories would be a control the map API can't honour.
 */
const MAP_CATEGORIES: { value: EventCategory; label: string }[] = Array.from(
  new Map(
    TAXONOMY.filter((g) => !g.query.q).map((g) => [
      g.category,
      { value: g.category, label: g.label },
    ])
  ).values()
);

export default function MapView() {
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // One anchor per mount, as on the home page: a fresh Date each render
  // would change the derived window and refetch forever.
  const [nowIso] = useState(() => new Date().toISOString());
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  /**
   * The map's day filter is a real bounded window on the bounds query
   * (migration 003 added the upper bound). Filtering client-side would be
   * wrong: the RPC caps its result set by start_time, so a far-enough day
   * would fall outside it and read as empty.
   */
  const timeWindow = useMemo(() => {
    if (!day) return {};
    const { from, to } = resolveDay(day, now);
    return { from_time: from, to_time: to };
  }, [day, now]);

  // DateStrip speaks the shared Filters shape; the map only varies the day.
  const stripFilters = useMemo(
    () => ({ ...EMPTY_FILTERS, day }),
    [day]
  );
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ loading: boolean; error: string | null }>({
    loading: true,
    error: null,
  });

  const handleEvents = useCallback((next: Event[]) => {
    setEvents(next);
    // Drop a selection that has panned out of the result set.
    setSelectedId((current) =>
      current && next.some((e) => e.id === current) ? current : null
    );
  }, []);

  const handleStatus = useCallback(
    (next: { loading: boolean; error: string | null }) => setStatus(next),
    []
  );

  const listed = useMemo(
    () => events.filter((e) => e.lat != null && e.lng != null),
    [events]
  );

  return (
    <div className="map-page">
      <div className="map-bar">
        <SearchConsole value={q} onSubmit={setQ} size="compact" />
        <DateStrip
          filters={stripFilters}
          now={now}
          onChange={(patch) => setDay(patch.day ?? null)}
        />
        <div className="chip-row scrollbar-hide" aria-label="Filter map by category">
          <button
            type="button"
            className="chip"
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
          >
            All categories
          </button>
          {MAP_CATEGORIES.map((c) => {
            const paint = getCategoryPaint(c.value);
            return (
              <button
                key={c.value}
                type="button"
                className="chip"
                aria-pressed={category === c.value}
                onClick={() => setCategory(category === c.value ? null : c.value)}
              >
                <span
                  className="chip-dot"
                  style={{ background: paint.marker }}
                  aria-hidden="true"
                />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="map-split">
        <aside className="map-aside" aria-label="Events in view">
          <div className="map-aside-head">
            <h1 className="section-title" style={{ fontSize: "1.25rem" }}>
              {q ? `“${q}” in this area` : "In this area"}
            </h1>
            <span className="meta numeric">
              {status.loading ? "…" : listed.length}
            </span>
          </div>

          {status.error ? (
            <p className="meta" role="alert">
              Couldn&rsquo;t load events for this area.
            </p>
          ) : listed.length === 0 && !status.loading ? (
            <p className="meta">
              No mapped events{q ? ` matching “${q}”` : ""}
              {day ? " on this day" : ""} here. Pan or zoom out to widen the
              search —
              online events have no location, so they only appear in{" "}
              <Link href="/?format=online" style={{ textDecoration: "underline" }}>
                the main feed
              </Link>
              .
            </p>
          ) : (
            <ul className="rail-list" style={{ listStyle: "none" }}>
              {listed.map((event) => {
                const paint = getCategoryPaint(event.category);
                const active = event.id === selectedId;
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      className="card card-compact"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        borderColor: active ? "var(--ember)" : undefined,
                      }}
                      aria-pressed={active}
                      onClick={() => setSelectedId(active ? null : event.id)}
                    >
                      <div className="card-body">
                        <p className="card-kicker micro">
                          <span
                            className="chip-dot"
                            style={{ background: paint.marker }}
                            aria-hidden="true"
                          />
                          {formatDayOnly(event.start_time)}
                        </p>
                        <p className="card-title">{event.title}</p>
                        {event.location_name && (
                          <p className="card-where">
                            <PinIcon />
                            <span>{event.location_name}</span>
                          </p>
                        )}
                      </div>
                    </button>
                    {active && (
                      <Link
                        href={`/events/${event.id}`}
                        className="section-link"
                        style={{ padding: "0.5rem 0.875rem" }}
                      >
                        View details
                        <ArrowRightIcon size={13} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="map-stage">
          <EventMap
            category={category}
            window={timeWindow}
            q={q}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEventsChange={handleEvents}
            onStatusChange={handleStatus}
          />
        </div>
      </div>
    </div>
  );
}
