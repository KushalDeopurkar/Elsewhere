"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LngLatBounds, MapLibreMap, Marker, setWorkerUrl, GeoJSONSource } from "maplibre-gl";
import type { RouteLine } from "@/components/TravelTime";
import { Event } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import {
  STYLE_URL,
  FALLBACK_STYLE_URL,
  DEFAULT_VIEW,
  applyDarkTheme,
  add3DBuildings,
} from "@/lib/mapTheme";
import type { MapBounds } from "@/lib/api";

// Must be set before the first Map is constructed. See
// scripts/copy-maplibre-worker.mjs for why the worker is served from public/.
setWorkerUrl("/maplibre-gl-worker.mjs");

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface MapHandle {
  flyToEvent: (event: Event) => void;
  flyToPoint: (lat: number, lng: number) => void;
}

export default function EventMap({
  events,
  selectedId,
  onSelect,
  onBoundsChange,
  onReady,
  onError,
  route = null,
}: {
  route?: RouteLine | null;
  events: Event[];
  selectedId: string | null;
  onSelect: (event: Event) => void;
  onBoundsChange: (bounds: MapBounds) => void;
  onReady?: (handle: MapHandle) => void;
  onError?: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const didLoad = useRef(false);
  const triedFallback = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [bearing, setBearing] = useState<number>(DEFAULT_VIEW.bearing);
  const [styleRev, setStyleRev] = useState(0);
  const originPin = useRef<Marker | null>(null);

  // Callbacks are held in refs so the map is built exactly once; re-creating
  // a GL context on every parent render would thrash the GPU.
  const cb = useRef({ onSelect, onBoundsChange, onReady, onError });
  useEffect(() => {
    cb.current = { onSelect, onBoundsChange, onReady, onError };
  });

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
      ...DEFAULT_VIEW,
      attributionControl: { compact: true },
      maxPitch: 70,
      // Rotation: right-click / ctrl+drag on desktop, two-finger twist on touch,
      // shift+arrow keys on keyboard. Buttons in .map-tools cover the rest.
      dragRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
      pitchWithRotate: true,
      keyboard: true,
    });
    instance.touchZoomRotate.enableRotation();

    map.current = instance;

    const reportBounds = () => {
      const b = instance.getBounds();
      cb.current.onBoundsChange({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    };

    // Fires for the initial style and again after any setStyle, so the
    // fallback basemap is themed exactly like the primary one.
    instance.on("style.load", () => {
      applyDarkTheme(instance);
      add3DBuildings(instance);
      setStyleRev((n) => n + 1);
    });

    instance.on("load", () => {
      didLoad.current = true;
      setLoaded(true);
      reportBounds();
      cb.current.onReady?.({
        flyToEvent: (event) => {
          if (event.lat == null || event.lng == null) return;
          instance.flyTo({
            center: [event.lng, event.lat],
            zoom: Math.max(instance.getZoom(), 15.5),
            pitch: 58,
            duration: prefersReducedMotion() ? 0 : 1200,
            essential: true,
          });
        },
        flyToPoint: (lat, lng) => {
          instance.flyTo({
            center: [lng, lat],
            zoom: 11.5,
            pitch: 45,
            duration: prefersReducedMotion() ? 0 : 1400,
            essential: true,
          });
        },
      });
    });

    instance.on("moveend", reportBounds);
    instance.on("rotate", () => setBearing(instance.getBearing()));

    instance.on("error", (e: { error?: { message?: string } }) => {
      // Once the style is up, a single bad tile or missing glyph range is not
      // worth blanking a working map for. Only a map that never loaded at all
      // gets the error panel.
      if (didLoad.current) {
        console.warn("[map]", e?.error?.message ?? e);
        return;
      }

      // The primary basemap never came up. Swap providers once before
      // telling the viewer the map is unavailable.
      if (!triedFallback.current) {
        triedFallback.current = true;
        console.warn(
          `[map] ${STYLE_URL} failed, falling back to ${FALLBACK_STYLE_URL}`,
          e?.error?.message ?? e,
        );
        try {
          instance.setStyle(FALLBACK_STYLE_URL);
          return;
        } catch {
          // Fall through to the error panel below.
        }
      }

      cb.current.onError?.(
        e?.error?.message ?? "The basemap could not be loaded.",
      );
    });

    // A silent hang (no error event, no load) should still resolve to a state
    // the viewer can act on rather than an empty dark rectangle.
    const stall = setTimeout(() => {
      if (didLoad.current) return;
      if (!triedFallback.current) {
        triedFallback.current = true;
        try {
          instance.setStyle(FALLBACK_STYLE_URL);
          setTimeout(() => {
            if (!didLoad.current) {
              cb.current.onError?.("The map took too long to load.");
            }
          }, 10000);
          return;
        } catch {
          // Fall through.
        }
      }
      cb.current.onError?.("The map took too long to load.");
    }, 10000);

    const pins = markers.current;

    return () => {
      clearTimeout(stall);
      pins.forEach((pin) => pin.remove());
      pins.clear();
      instance.remove();
      map.current = null;
    };
  }, []);

  // Reconcile markers against the event list: add what is new, drop what is
  // gone, and leave untouched pins alone so they do not flicker on refetch.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !loaded) return;

    const wanted = new Set<string>();

    for (const event of events) {
      if (event.lat == null || event.lng == null) continue;
      wanted.add(event.id);
      if (markers.current.has(event.id)) continue;

      const hue = getCategoryColor(event.category);

      // MapLibre owns the marker element's position and transform (it writes
      // an inline translate on every frame). Keep that element bare and put
      // all styling, hover scale and transitions on an inner button, or the
      // pin drifts away from its coordinate while the map moves.
      const anchor = document.createElement("div");
      anchor.className = "pin-anchor";

      const el = document.createElement("button");
      el.type = "button";
      el.className = "pin pin-cat";
      el.style.setProperty("--pin-hue", hue.color);
      el.style.setProperty("--pin-halo", hue.halo);
      el.setAttribute("aria-label", event.title);
      el.innerHTML =
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="5"/></svg>';
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        cb.current.onSelect(event);
      });
      anchor.appendChild(el);

      markers.current.set(
        event.id,
        new Marker({
          element: anchor,
          anchor: "center",
          // Pins stay upright and face the viewer whatever the bearing/pitch.
          rotationAlignment: "viewport",
          pitchAlignment: "viewport",
        })
          .setLngLat([event.lng, event.lat])
          .addTo(instance),
      );
    }

    for (const [id, marker] of markers.current) {
      if (!wanted.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
  }, [events, loaded]);

  // Travel route from the viewer's start point to the selected venue. Lives
  // in its own source so a style swap (fallback basemap) can redraw it.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !loaded) return;
    const SRC = "travel-route";
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features:
        route && route.line.length > 1
          ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.line } }]
          : [],
    };
    const existing = instance.getSource(SRC) as GeoJSONSource | undefined;
    if (existing) existing.setData(data);
    else {
      instance.addSource(SRC, { type: "geojson", data });
      instance.addLayer({
        id: "travel-route-casing",
        type: "line",
        source: SRC,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#1a1410", "line-width": 8, "line-opacity": 0.85 },
      });
      instance.addLayer({
        id: "travel-route-line",
        type: "line",
        source: SRC,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#f5b83d", "line-width": 4.5 },
      });
    }

    originPin.current?.remove();
    originPin.current = null;
    if (!route) return;
    const anchor = document.createElement("div");
    const dot = document.createElement("span");
    dot.className = "origin-pin";
    dot.title = "Your start point";
    anchor.appendChild(dot);
    originPin.current = new Marker({ element: anchor, anchor: "center" })
      .setLngLat([route.origin.lng, route.origin.lat])
      .addTo(instance);

    const pts = route.line.length > 1 ? route.line : [[route.origin.lng, route.origin.lat] as [number, number]];
    const b = new LngLatBounds(pts[0], pts[0]);
    pts.forEach((c) => b.extend(c));
    // Keep the route clear of the event card: it sits on the left on wide
    // maps and across the lower half on phones.
    const { clientWidth: w, clientHeight: h } = instance.getContainer();
    const wide = w >= 700;
    instance.fitBounds(b, {
      padding: wide
        ? { top: 90, bottom: 60, left: Math.min(420, w * 0.45), right: 80 }
        : { top: 130, bottom: Math.round(h * 0.6), left: 40, right: 60 },
      maxZoom: 15,
      duration: prefersReducedMotion() ? 0 : 900,
    });
  }, [route, loaded, styleRev]);

  // Active pin styling lives outside the reconcile pass so selecting an event
  // never rebuilds markers.
  useEffect(() => {
    for (const [id, marker] of markers.current) {
      marker.getElement().classList.toggle("is-active", id === selectedId);
    }
  }, [selectedId, events]);

  const nudge = useCallback((delta: number) => {
    map.current?.easeTo({
      zoom: (map.current?.getZoom() ?? DEFAULT_VIEW.zoom) + delta,
      duration: prefersReducedMotion() ? 0 : 300,
    });
  }, []);

  const rotate = useCallback((delta: number) => {
    const m = map.current;
    if (!m) return;
    m.easeTo({
      bearing: m.getBearing() + delta,
      duration: prefersReducedMotion() ? 0 : 400,
    });
  }, []);

  const resetNorth = useCallback(() => {
    map.current?.easeTo({
      bearing: 0,
      duration: prefersReducedMotion() ? 0 : 500,
    });
  }, []);

  const reset = useCallback(() => {
    map.current?.easeTo({
      ...DEFAULT_VIEW,
      duration: prefersReducedMotion() ? 0 : 900,
    });
  }, []);

  return (
    <>
      <div ref={container} className="map-canvas" />
      <div className="map-tools">
        <button type="button" className="map-tool" onClick={() => nudge(1)} aria-label="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button type="button" className="map-tool" onClick={() => nudge(-1)} aria-label="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button type="button" className="map-tool" onClick={() => rotate(-30)} aria-label="Rotate left" title="Rotate left (or right-click and drag)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" />
          </svg>
        </button>
        <button type="button" className="map-tool" onClick={() => rotate(30)} aria-label="Rotate right" title="Rotate right (or right-click and drag)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
          </svg>
        </button>
        <button type="button" className="map-tool map-compass" onClick={resetNorth} aria-label="Point north" title="Point north">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${-bearing}deg)` }}>
            <path d="M12 3l3.5 9h-7z" fill="var(--marigold)" />
            <path d="M12 21l-3.5-9h7z" fill="currentColor" opacity="0.5" />
          </svg>
        </button>
        <button type="button" className="map-tool" onClick={reset} aria-label="Reset the view">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
          </svg>
        </button>
      </div>
    </>
  );
}
