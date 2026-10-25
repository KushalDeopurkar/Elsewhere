"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { Event, EventCategory, categoryLabel } from "@/lib/types";
import { getMapEvents, MapBounds } from "@/lib/api";
import { getCategoryPaint } from "@/lib/categoryColors";
import { formatEventDate } from "@/lib/formatDate";
import { ArrowRightIcon } from "./icons";

const BOUNDS_DEBOUNCE_MS = 300;

/**
 * Category-coloured teardrop pins, built from an inline SVG string so no
 * marker image is fetched from a CDN. Icons are cached per category and
 * selection state, since react-leaflet rebuilds markers on every pan.
 */
const markerIconCache = new Map<string, L.DivIcon>();

function getMarkerIcon(category: EventCategory, selected: boolean): L.DivIcon {
  const cacheKey = `${category}:${selected}`;
  const cached = markerIconCache.get(cacheKey);
  if (cached) return cached;

  const { marker } = getCategoryPaint(category);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="35" viewBox="0 0 28 38">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 12.15 21.85 13.06 22.78a1.33 1.33 0 0 0 1.88 0C15.85 35.85 28 23.5 28 14 28 6.27 21.73 0 14 0z" fill="${marker}"/>
      <circle cx="14" cy="14" r="8" fill="white"/>
      <circle cx="14" cy="14" r="${selected ? 5.5 : 4}" fill="${marker}"/>
    </svg>`;

  const icon = L.divIcon({
    html: svg,
    className: `map-marker-icon${selected ? " is-selected" : ""}`,
    iconSize: [26, 35],
    iconAnchor: [13, 33],
    popupAnchor: [0, -28],
  });

  markerIconCache.set(cacheKey, icon);
  return icon;
}

/** Reports current bounds on mount and after every (debounced) pan/zoom. */
function BoundsReporter({ onBoundsChange }: { onBoundsChange: (b: MapBounds) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const emit = useCallback(
    (map: L.Map) => {
      const b = map.getBounds();
      onBoundsChange({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    },
    [onBoundsChange]
  );

  const map = useMapEvents({
    moveend: () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => emit(map), BOUNDS_DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    // moveend never fires for the starting viewport, so seed the first fetch.
    emit(map);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

/** Pans to the event selected from the list alongside the map. */
function SelectionFocus({ target }: { target: Event | null }) {
  const map = useMap();

  useEffect(() => {
    if (target?.lat == null || target?.lng == null) return;
    map.panTo([target.lat, target.lng], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  return null;
}

function hasCoords(event: Event): event is Event & { lat: number; lng: number } {
  return event.lat != null && event.lng != null;
}

export interface EventMapProps {
  center?: [number, number];
  zoom?: number;
  category?: EventCategory | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onEventsChange?: (events: Event[]) => void;
  onStatusChange?: (status: { loading: boolean; error: string | null }) => void;
}

export default function EventMap({
  center = [19.076, 72.8777], // Mumbai
  zoom = 12,
  category = null,
  selectedId = null,
  onSelect,
  onEventsChange,
  onStatusChange,
}: EventMapProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Keep callbacks in refs so the fetch effect doesn't re-run when a parent
  // re-renders with fresh closures.
  const notifyEvents = useRef(onEventsChange);
  const notifyStatus = useRef(onStatusChange);
  useEffect(() => {
    notifyEvents.current = onEventsChange;
    notifyStatus.current = onStatusChange;
  }, [onEventsChange, onStatusChange]);

  const fetchEvents = useCallback(async (b: MapBounds, cat: EventCategory | null) => {
    setLoading(true);
    setError(null);
    notifyStatus.current?.({ loading: true, error: null });
    try {
      const data = await getMapEvents(b, cat || undefined);
      setEvents(data);
      notifyEvents.current?.(data);
      notifyStatus.current?.({ loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load events";
      setError(message);
      setEvents([]);
      notifyEvents.current?.([]);
      notifyStatus.current?.({ loading: false, error: message });
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  const handleBoundsChange = useCallback(
    (b: MapBounds) => {
      setBounds(b);
      fetchEvents(b, category);
    },
    [fetchEvents, category]
  );

  useEffect(() => {
    // Re-query the current viewport whenever the category changes.
    if (bounds) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchEvents(bounds, category);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const markers = useMemo(() => events.filter(hasCoords), [events]);
  const selected = useMemo(
    () => markers.find((e) => e.id === selectedId) ?? null,
    [markers, selectedId]
  );

  return (
    <>
      <MapContainer center={center} zoom={zoom} className="map-leaflet-root" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BoundsReporter onBoundsChange={handleBoundsChange} />
        <SelectionFocus target={selected} />

        {markers.map((event) => {
          const paint = getCategoryPaint(event.category);
          return (
            <Marker
              key={event.id}
              position={[event.lat, event.lng]}
              icon={getMarkerIcon(event.category, event.id === selectedId)}
              eventHandlers={{ click: () => onSelect?.(event.id) }}
            >
              <Popup minWidth={210} maxWidth={260}>
                <span className="card-kicker micro">
                  <span
                    className="chip-dot"
                    style={{ background: paint.marker }}
                    aria-hidden="true"
                  />
                  {categoryLabel(event.category)}
                </span>
                <p className="popup-title">{event.title}</p>
                <p className="popup-meta numeric">{formatEventDate(event.start_time)}</p>
                {event.location_name && (
                  <p className="popup-meta">{event.location_name}</p>
                )}
                <Link href={`/events/${event.id}`} className="popup-link">
                  View details
                  <ArrowRightIcon size={13} />
                </Link>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {loading && (
        <div className="map-pill" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          Loading events…
        </div>
      )}

      {!loading && !error && loadedOnce && markers.length === 0 && (
        <div className="map-pill" role="status">
          No mapped events in this area — try panning or zooming out
        </div>
      )}

      {!loading && error && (
        <div className="map-pill map-pill-error" role="alert">
          Couldn&rsquo;t load events
          <button
            type="button"
            className="button"
            style={{ padding: "0.25rem 0.5rem" }}
            onClick={() => bounds && fetchEvents(bounds, category)}
          >
            Retry
          </button>
        </div>
      )}
    </>
  );
}
