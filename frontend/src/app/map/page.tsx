"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { X, Sparkle, WarningCircle, ArrowRight, ListBullets, MapTrifold } from "@phosphor-icons/react/ssr";
import EventImage from "@/components/EventImage";
import TravelTime, { RouteLine } from "@/components/TravelTime";
import LocationSelector from "@/components/LocationSelector";
import { useCity } from "@/lib/cityPref";
import { CategoryRail } from "@/components/FilterRail";
import type { MapHandle } from "@/components/EventMap";
import { getMapEvents, MapBounds } from "@/lib/api";
import { Event, EventCategory } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { formatWhen } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";

// maplibre-gl touches window at import time, so the map never renders on the
// server. Everything around it still does.
const EventMap = dynamic(() => import("@/components/EventMap"), {
  ssr: false,
  loading: () => (
    <div className="map-status">
      <p className="panel-title">Loading the map</p>
    </div>
  ),
});

export default function MapPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [selected, setSelected] = useState<Event | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const [route, setRoute] = useState<RouteLine | null>(null);
  const handle = useRef<MapHandle | null>(null);
  const bounds = useRef<MapBounds | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (next: MapBounds, cat: EventCategory | null) => {
    const id = ++requestId.current;
    const res = await getMapEvents(next, cat ?? undefined);
    if (id !== requestId.current) return;
    setEvents(res.events);
    setIsSample(res.isSample);
  }, []);

  const onBoundsChange = useCallback(
    (next: MapBounds) => {
      bounds.current = next;
      load(next, category);
    },
    [load, category],
  );

  // Refetch when the category changes without waiting for the next pan.
  useEffect(() => {
    if (bounds.current) load(bounds.current, category);
  }, [category, load]);

  const pick = useCallback((event: Event) => {
    setSelected(event);
    setRoute(null);
    handle.current?.flyToEvent(event);
  }, []);

  const hue = selected ? getCategoryColor(selected.category) : null;
  const [mobileView, setMobileView] = useState<"map" | "list">("map");

  // Follow the location selector: fly to the chosen city once the map is up.
  const city = useCity();
  const ready = useRef(false);
  useEffect(() => {
    if (ready.current) handle.current?.flyToPoint(city.lat, city.lng);
  }, [city]);

  const listed = [...events]
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
    .slice(0, 60);

  return (
    <div className={`map-split is-${mobileView}`}>
      <aside className="map-list" aria-label="Events in view">
        <div className="map-list-head">
          <p className="map-list-title">
            <strong>{events.length}</strong> events in view
          </p>
          <LocationSelector compact />
        </div>
        {events.length === 0 ? (
          <p className="muted map-list-empty">Nothing in this part of the map. Zoom out or pan to a city.</p>
        ) : (
          <ul className="map-list-items">
            {listed.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={`map-item${selected?.id === e.id ? " is-active" : ""}`}
                  onClick={() => {
                    pick(e);
                    setMobileView("map");
                  }}
                >
                  <span className="map-item-thumb">
                    <EventImage src={e.image_url} category={e.category} ratio="1 / 1" />
                  </span>
                  <span className="map-item-body">
                    <span className="map-item-title">{e.title}</span>
                    <span className="map-item-meta">{formatWhen(e.start_time)}</span>
                    <span className="map-item-meta">
                      {priceBadge(e)}
                      {e.location_name ? ` · ${e.location_name}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {events.length > listed.length && (
          <p className="muted map-list-more">Showing the {listed.length} soonest. Zoom in to narrow it down.</p>
        )}
      </aside>

      <div className="map-switch" role="group" aria-label="View">
        <button type="button" aria-pressed={mobileView === "map"} onClick={() => setMobileView("map")}>
          <MapTrifold size={16} weight="bold" /> Map
        </button>
        <button type="button" aria-pressed={mobileView === "list"} onClick={() => setMobileView("list")}>
          <ListBullets size={16} weight="bold" /> List ({events.length})
        </button>
      </div>

    <div className="map-page">
      <EventMap
        events={events}
        selectedId={selected?.id ?? null}
        onSelect={pick}
        onBoundsChange={onBoundsChange}
        onReady={(h) => {
          handle.current = h;
          ready.current = true;
        }}
        onError={(m) => setMapError((prev) => prev ?? m)}
        route={selected ? route : null}
      />

      {mapError && (
        <div className="map-status">
          <div className="panel is-error" role="alert">
            <WarningCircle size={30} weight="duotone" className="panel-icon" />
            <p className="panel-title">The basemap did not load</p>
            <p className="panel-body">
              Both basemap providers were unreachable. The browser console
              names the URLs that failed. To use a different provider, set
              NEXT_PUBLIC_MAP_STYLE to any MapLibre style URL.
            </p>
            <div className="panel-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
              <Link href="/" className="btn btn-primary">
                Browse as a list
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="map-overlay">
        <div className="map-bar">
          <span className="map-count mono">
            <strong>{events.length}</strong> nearby
          </span>
          <CategoryRail value={category} onChange={setCategory} />
        </div>

        {isSample && !mapError && (
          <span className="sample-note" style={{ alignSelf: "flex-start" }}>
            <Sparkle size={13} weight="fill" />
            Sample data, the API is not connected
          </span>
        )}

        {selected && (
          <article className="map-peek">
            <div className="map-peek-media">
                <EventImage src={selected.image_url} category={selected.category} ratio="16 / 9" />
              <button
                type="button"
                className="map-peek-close"
                onClick={() => {
                  setSelected(null);
                  setRoute(null);
                }}
                aria-label="Close"
              >
                <X size={13} weight="bold" />
              </button>
            </div>
            <div className="map-peek-body">
              <p
                className="card-kicker"
                style={{ "--cat-hue": hue?.color } as React.CSSProperties}
              >
                {priceBadge(selected)}
              </p>
              <h3 className="card-title">{selected.title}</h3>
              <p className="card-time mono">{formatWhen(selected.start_time)}</p>
              <p className="card-foot">
                <span>
                  {selected.location_name}
                  {selected.city ? `, ${selected.city}` : ""}
                </span>
              </p>
              <Link
                href={`/events/${selected.id}`}
                className="section-link"
                style={{ marginTop: "0.3rem" }}
              >
                Full details
                <ArrowRight size={13} weight="bold" />
              </Link>
              <TravelTime key={selected.id} event={selected} onRoute={setRoute} />
            </div>
          </article>
        )}
      </div>
    </div>
    </div>
  );
}
