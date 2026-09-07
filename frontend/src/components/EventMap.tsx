"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { CATEGORIES, Event, EventCategory } from "@/lib/types";
import { getMapEvents, MapBounds } from "@/lib/api";
import { getCategoryColor } from "@/lib/categoryColors";
import { formatEventDate } from "@/lib/formatDate";

const BOUNDS_DEBOUNCE_MS = 300;

/**
 * Custom teardrop pin markers built from an inline SVG string, colored per
 * category. Avoids any dependency on unpkg.com (or any other CDN) for the
 * default Leaflet marker images. One icon is built per category and cached,
 * since react-leaflet re-renders markers frequently while panning.
 */
const markerIconCache = new Map<EventCategory, L.DivIcon>();

function getMarkerIcon(category: EventCategory): L.DivIcon {
  const cached = markerIconCache.get(category);
  if (cached) return cached;

  const { accent } = getCategoryColor(category);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 12.15 21.85 13.06 22.78a1.33 1.33 0 0 0 1.88 0C15.85 35.85 28 23.5 28 14 28 6.27 21.73 0 14 0z" fill="${accent}"/>
      <circle cx="14" cy="14" r="8.5" fill="white"/>
      <circle cx="14" cy="14" r="4.5" fill="${accent}"/>
    </svg>`;

  const icon = L.divIcon({
    html: svg,
    className: "map-marker-icon",
    iconSize: [28, 38],
    iconAnchor: [14, 36],
    popupAnchor: [0, -30],
  });

  markerIconCache.set(category, icon);
  return icon;
}

/** Reports the map's current bounds on mount and on every (debounced) pan/zoom. */
function MapController({ onBoundsChange }: { onBoundsChange: (bounds: MapBounds) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const emitBounds = useCallback(
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
      timerRef.current = setTimeout(() => emitBounds(map), BOUNDS_DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    // Seed the initial fetch — moveend never fires for the map's starting position.
    emitBounds(map);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

function hasCoords(event: Event): event is Event & { lat: number; lng: number } {
  return event.lat != null && event.lng != null;
}

interface EventMapProps {
  center?: [number, number];
  zoom?: number;
  category?: EventCategory | null;
}

export default function EventMap({
  center = [19.076, 72.8777], // Mumbai default
  zoom = 12,
  category = null,
}: EventMapProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchEvents = useCallback(async (b: MapBounds, cat: EventCategory | null) => {
    setLoading(true);
    try {
      const data = await getMapEvents(b, cat || undefined);
      setEvents(data);
    } catch (err) {
      console.error("Failed to fetch map events:", err);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
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
    // Re-fetch for the current viewport whenever the category filter changes;
    // fetchEvents owns its own loading/data state (see useEvents.ts for the
    // same established pattern).
    if (bounds) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchEvents(bounds, category);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const markers = useMemo(() => events.filter(hasCoords), [events]);

  return (
    <div className="map-canvas">
      <MapContainer center={center} zoom={zoom} className="map-leaflet-root" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController onBoundsChange={handleBoundsChange} />

        {markers.map((event) => {
          const cat = CATEGORIES.find((c) => c.value === event.category);
          const colors = getCategoryColor(event.category);
          return (
            <Marker
              key={event.id}
              position={[event.lat, event.lng]}
              icon={getMarkerIcon(event.category)}
            >
              <Popup className="map-popup" minWidth={220} maxWidth={260}>
                <div className="map-popup-body">
                  <span
                    className="badge badge-category"
                    style={{ "--cat-bg": colors.bg, "--cat-text": colors.text } as React.CSSProperties}
                  >
                    <span aria-hidden="true">{cat?.emoji}</span>
                    {cat?.label || event.category}
                  </span>
                  <p className="map-popup-title">{event.title}</p>
                  <p className="map-popup-date">{formatEventDate(event.start_time)}</p>
                  {event.location_name && (
                    <p className="map-popup-location">{event.location_name}</p>
                  )}
                  <Link href={`/events/${event.id}`} className="map-popup-link">
                    View details <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {loading && (
        <div className="map-status-pill" role="status" aria-live="polite">
          <span className="map-status-spinner" aria-hidden="true" />
          Loading events&hellip;
        </div>
      )}

      {!loading && hasLoadedOnce && markers.length === 0 && (
        <div className="map-status-pill map-status-pill-muted" role="status">
          No events in this area
        </div>
      )}
    </div>
  );
}
