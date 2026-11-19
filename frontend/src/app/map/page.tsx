"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { preconnect } from "react-dom";
import { STYLE_URL } from "@/lib/mapTheme";
import { X, Sparkle, WarningCircle, ArrowRight, ListBullets, MapTrifold } from "@phosphor-icons/react/ssr";
import { useCapable3D } from "@/hooks/useCapable3D";
import EventImage from "@/components/EventImage";
import TravelTime, { RouteLine } from "@/components/TravelTime";
import LocationSelector from "@/components/LocationSelector";
import { lastCityChangeQuiet, onCityRepick, useCity } from "@/lib/cityPref";
import { cityZone } from "@/lib/cities";
import { CategoryRail } from "@/components/FilterRail";
import type { MapHandle } from "@/components/EventMap";
import { getMapEvents, MapBounds } from "@/lib/api";
import { Event, EventCategory } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { whenOf } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import TimeScrubber from "@/components/TimeScrubber";
import MapStrip from "@/components/MapStrip";
import { HOUR, eventsAt, timelineStart } from "@/lib/timeline";

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

const RETRY_DELAYS = [3000, 8000, 15000];

export default function MapPage() {
  // Warm the connection to the map host. The map code itself loads after the
  // page has painted, so the header, filters and cards show up first.
  preconnect(new URL(STYLE_URL).origin, { crossOrigin: "anonymous" });
  const [allEvents, setEvents] = useState<Event[]>([]);
  const [now] = useState(() => Date.now());
  const [timeOn, setTimeOn] = useState(false);
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  const zoneCity = useCity();
  const tlStart = timelineStart(now, cityZone(zoneCity));
  const at = useMemo(
    () => (timeOn ? eventsAt(allEvents, tlStart + hour * HOUR) : null),
    [timeOn, allEvents, tlStart, hour],
  );
  const events = at ? at.events : allEvents;
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [selected, setSelected] = useState<Event | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const [route, setRoute] = useState<RouteLine | null>(null);
  const handle = useRef<MapHandle | null>(null);
  const bounds = useRef<MapBounds | null>(null);
  const requestId = useRef(0);

  const load = useCallback((next: MapBounds, cat: EventCategory | null) => {
    const id = ++requestId.current;
    // The API sleeps when idle and can fail its first requests while it
    // wakes. Retry quietly so live events replace the sample set.
    const run = async (attempt: number) => {
      const res = await getMapEvents(next, cat ?? undefined);
      if (id !== requestId.current) return;
      setEvents(res.events);
      setIsSample(res.isSample);
      if (res.isSample && attempt < RETRY_DELAYS.length) {
        window.setTimeout(() => {
          if (id === requestId.current) run(attempt + 1);
        }, RETRY_DELAYS[attempt]);
      }
    };
    run(0);
  }, []);

  const onBoundsChange = useCallback(
    (next: MapBounds) => {
      bounds.current = next;
      load(next, category);
    },
    [load, category],
  );

  // Fetch the city's events straight away, so the list and cards fill in
  // while the map is still loading; the map's own view takes over once up.
  const firstLoad = useRef(false);
  useEffect(() => {
    if (firstLoad.current || bounds.current) return;
    firstLoad.current = true;
    const c = zoneCity;
    load({ south: c.lat - 0.18, north: c.lat + 0.18, west: c.lng - 0.22, east: c.lng + 0.22 }, category);
  }, [load, category, zoneCity]);

  // Refetch when the category changes without waiting for the next pan.
  useEffect(() => {
    if (bounds.current) load(bounds.current, category);
  }, [category, load]);

  // Phone card strip. Its cards stay put while you swipe or tap pins (the
  // map moving to each venue would otherwise reload and reshuffle them);
  // dragging the map, or changing a filter, lets it follow the view again.
  const [stripLocked, setStripLocked] = useState(false);
  const pick = useCallback((event: Event) => {
    setStripLocked(true);
    setSelected(event);
    setRoute(null);
    handle.current?.flyToEvent(event);
  }, []);
  const [deckSrc, setDeckSrc] = useState<Event[]>(events);
  if (!stripLocked && deckSrc !== events) setDeckSrc(events);
  const deck = useMemo(() => {
    const sorted = [...deckSrc].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time)).slice(0, 40);
    return selected && !sorted.some((e) => e.id === selected.id) ? [selected, ...sorted] : sorted;
  }, [deckSrc, selected]);
  const glide = useCallback((event: Event) => {
    setStripLocked(true);
    setSelected(event);
    setRoute(null);
    handle.current?.glideToEvent(event);
  }, []);

  const hue = selected ? getCategoryColor(selected.category) : null;
  const [mobileView, setMobileView] = useState<"map" | "list">("map");

  // Follow the location selector: fly to the chosen city once the map is up.
  const city = useCity();
  const can3d = useCapable3D();
  // City lights over the map on big screens that can carry it; pins otherwise.
  // They animate every frame, so they start with the first drag, scroll or
  // zoom: the page itself loads and settles without them.
  const [awake, setAwake] = useState(false);
  const lightsOn = can3d && awake;
  const wake = useCallback(() => setAwake(true), []);
  // Woken by a gesture: switch on once the finger lifts and the map has
  // coasted, so the tilt-in never fights a drag in progress.
  const wakeAfterGesture = useCallback(() => {
    window.addEventListener("pointerup", () => window.setTimeout(wake, 700), { once: true });
  }, [wake]);
  const flyLabel = useRef<HTMLParagraphElement>(null);
  const ready = useRef(false);
  // Changing city flies across the country to it, with a title card.
  const lastCity = useRef(city.name);
  const pendingJump = useRef(false);
  const lastCityPoint = useRef(city);
  useEffect(() => {
    lastCityPoint.current = city;
  }, [city]);
  useEffect(() => {
    const moved = lastCity.current !== city.name;
    lastCity.current = city.name;
    // A first-visit guess (or one landing before the map is up) just puts the
    // map there: no flight across the globe, no title card.
    const quiet = lastCityChangeQuiet();
    if (!ready.current) {
      if (moved) pendingJump.current = true;
      return;
    }
    if (quiet) {
      handle.current?.jumpToPoint(city.lat, city.lng);
      return;
    }
    handle.current?.flyToPoint(city.lat, city.lng, moved);
    const el = flyLabel.current;
    if (moved && el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = `Flying to ${city.name}`;
      el.classList.remove("is-on");
      void el.offsetWidth;
      el.classList.add("is-on");
    }
  }, [city]);

  // Picking the city that's already selected (say after dragging away)
  // brings the map back to it.
  useEffect(
    () =>
      onCityRepick(() => {
        if (ready.current) handle.current?.flyToPoint(city.lat, city.lng);
      }),
    [city],
  );

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
          <p className="muted map-list-empty">
            {timeOn ? "Nothing on at this moment here. Drag the timeline or zoom out." : "Nothing in this part of the map. Zoom out or pan to a city."}
          </p>
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
                    <EventImage src={e.image_url} category={e.category} ratio="1 / 1" width={96} />
                  </span>
                  <span className="map-item-body">
                    <span className="map-item-title">{e.title}</span>
                    <span className="map-item-meta">{whenOf(e)}</span>
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

    <div
      className={`map-page${lightsOn ? " is-lights" : ""}`}
      onWheel={
        awake
          ? undefined
          : (e) => {
              if ((e.target as HTMLElement).closest(".maplibregl-canvas-container")) window.setTimeout(wake, 900);
            }
      }
      onPointerDown={(e) => {
        if (!awake && (e.target as HTMLElement).closest(".maplibregl-canvas-container")) wakeAfterGesture();
        if (stripLocked && (e.target as HTMLElement).closest(".maplibregl-canvas-container")) setStripLocked(false);
      }}
    >
      <EventMap
        cityLights={lightsOn}
        events={events}
        selectedId={selected?.id ?? null}
        onSelect={pick}
        onBoundsChange={onBoundsChange}
        onReady={(h) => {
          handle.current = h;
          ready.current = true;
          if (pendingJump.current) {
            pendingJump.current = false;
            h.jumpToPoint(lastCityPoint.current.lat, lastCityPoint.current.lng);
          }
        }}
        onError={(m) => setMapError((prev) => prev ?? m)}
        route={selected ? route : null}
        liveIds={at?.live ?? null}
      />

      <p className="map-fly" ref={flyLabel} aria-hidden="true" />

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
          <CategoryRail
            value={category}
            onChange={(c) => {
              setStripLocked(false);
              setCategory(c);
            }}
          />
        </div>

        <TimeScrubber
          zone={cityZone(city)}
          events={allEvents}
          start={tlStart}
          now={now}
          on={timeOn}
          hour={hour}
          playing={playing}
          setOn={setTimeOn}
          setHour={setHour}
          setPlaying={setPlaying}
          shown={events.length}
          live={at?.live.size ?? 0}
        />

        {isSample && !mapError && (
          <span className="sample-note" style={{ alignSelf: "flex-start" }}>
            <Sparkle size={13} weight="fill" />
            Sample data, the API is not connected
          </span>
        )}

        <MapStrip events={deck} selectedId={selected?.id ?? null} onFocus={glide} />

        {selected && (
          <article className="map-peek">
            <div className="map-peek-media">
                <EventImage src={selected.image_url} category={selected.category} ratio="16 / 9" width={380} />
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
              <p className="card-time mono">{whenOf(selected)}</p>
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
