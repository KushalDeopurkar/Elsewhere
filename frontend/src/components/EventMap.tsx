"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LngLat, LngLatBounds, MapLibreMap, Marker, setWorkerUrl, GeoJSONSource } from "maplibre-gl";
import type { RouteLine } from "@/components/TravelTime";
import { Event } from "@/lib/types";
import { getCategoryColorFixed } from "@/lib/categoryColors";
import {
  STYLE_URL,
  FALLBACK_STYLE_URL,
  DEFAULT_VIEW,
  applyDarkTheme,
  add3DBuildings,
} from "@/lib/mapTheme";
import type { MapBounds } from "@/lib/api";
import type { CityLights } from "@/lib/cityLightsLayer";
import { sized } from "@/lib/imageUrl";
import { cityHop, isHopFrame } from "@/lib/cityHop";
import { gridCluster } from "@/lib/mapClusters";

// Must be set before the first Map is constructed. See
// scripts/copy-maplibre-worker.mjs for why the worker is served from public/.
setWorkerUrl("/maplibre-gl-worker.mjs");

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface MapHandle {
  flyToEvent: (event: Event) => void;
  /** A gentle glide to an event (swiping the phone card strip). */
  glideToEvent: (event: Event) => void;
  /** With `travel` (or when the view is far away), the camera hops between cities. */
  flyToPoint: (lat: number, lng: number, travel?: boolean) => void;
  /** Move there at once, no animation. */
  jumpToPoint: (lat: number, lng: number) => void;
}

/** Most pins drawn at once (the soonest events in view). */
const MAX_PINS = 80;
/** Clustering: below this zoom, with more than CLUSTER_FROM events in view, group pins within a CLUSTER_CELL px grid. */
const CLUSTER_UNTIL_ZOOM = 14;
const CLUSTER_FROM = 24;
const CLUSTER_CELL = 64;

export default function EventMap({
  events,
  selectedId,
  onSelect,
  onBoundsChange,
  onReady,
  onError,
  route = null,
  liveIds = null,
  cityLights = false,
  hoverId = null,
}: {
  /** The event pointed at in the list beside the map: its pin lifts. */
  hoverId?: string | null;
  /** Draw the 3D city of lights (streets and event beams) over the map. Desktop only. */
  cityLights?: boolean;
  route?: RouteLine | null;
  /** Pins for these events pulse: they are on at the scrubbed moment. */
  liveIds?: ReadonlySet<string> | null;
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
  const clusterMarkers = useRef(new Map<string, Marker>());
  const didLoad = useRef(false);
  const triedFallback = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [bearing, setBearing] = useState<number>(DEFAULT_VIEW.bearing);
  const [styleRev, setStyleRev] = useState(0);
  // Bumped when the map settles somewhere new, so pins are re-picked for the view.
  const [viewRev, setViewRev] = useState(0);
  const originPin = useRef<Marker | null>(null);
  const lights = useRef<CityLights | null>(null);
  const lightsOn = useRef(cityLights);

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

    const reportBounds = (e?: unknown) => {
      if (isHopFrame(e)) return; // mid-hop between cities
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
        glideToEvent: (event) => {
          if (event.lat == null || event.lng == null) return;
          const to = new LngLat(event.lng, event.lat);
          // Far away (another part of town): a short flight; nearby: a pan.
          const far = instance.getCenter().distanceTo(to) > 6000;
          instance.easeTo({
            center: to,
            zoom: Math.min(Math.max(instance.getZoom(), 13.5), 15.5),
            // Keep the card strip from covering the venue.
            offset: [0, -60],
            duration: prefersReducedMotion() ? 0 : far ? 900 : 600,
            essential: true,
          });
        },
        jumpToPoint: (lat, lng) => {
          instance.jumpTo({ center: [lng, lat], zoom: lightsOn.current ? 12 : 11.5 });
        },
        flyToPoint: (lat, lng, travel = false) => {
          const city = lightsOn.current;
          // A far drag away counts as travel too: hop back rather than pan.
          const far = instance.getCenter().distanceTo(new LngLat(lng, lat)) > 80_000;
          if ((travel || far) && !prefersReducedMotion()) {
            // Changing city: lift until both cities are on screen, glide
            // across with the map visible the whole way, settle in.
            cityHop(instance, {
              center: [lng, lat],
              zoom: city ? 12 : 11.5,
              pitch: city ? 60 : 45,
              bearing: city ? -20 : instance.getBearing(),
              duration: 2200,
            });
            return;
          }
          instance.flyTo({
            center: [lng, lat],
            zoom: city ? 12 : 11.5,
            pitch: city ? 60 : 45,
            bearing: city ? -20 : instance.getBearing(),
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
    const groups = clusterMarkers.current;

    return () => {
      clearTimeout(stall);
      pins.forEach((pin) => pin.remove());
      pins.clear();
      groups.forEach((pin) => pin.remove());
      groups.clear();
      instance.remove();
      map.current = null;
    };
  }, []);

  // City lights: a three.js layer in the map's own GL context. Added when
  // switched on (and again after a basemap swap), removed when off so the
  // map stops repainting every frame.
  useEffect(() => {
    lightsOn.current = cityLights;
    const instance = map.current;
    if (!instance || !loaded) return;
    instance.getContainer().classList.toggle("is-lights", cityLights);
    let alive = true;
    const onMoveEnd = (e: unknown) => {
      if (isHopFrame(e)) return;
      lights.current?.refreshStreets();
      // A new city's road tiles are still arriving: sample again once they're in.
      instance.once("idle", () => lights.current?.refreshStreets());
    };
    const onIdle = () => lights.current?.refreshStreets();
    if (cityLights) {
      void import("@/lib/cityLightsLayer").then(({ createCityLights, CITY_LIGHTS_LAYER }) => {
        if (!alive || !map.current) return;
        if (!lights.current) lights.current = createCityLights(instance);
        if (!instance.getLayer(CITY_LIGHTS_LAYER)) instance.addLayer(lights.current.layer);
        // Streets come from loaded tiles: sample again once they're in.
        instance.once("idle", onIdle);
        if (instance.getPitch() < 45) instance.easeTo({ pitch: 60, bearing: -20, duration: prefersReducedMotion() ? 0 : 900 });
      });
      instance.on("moveend", onMoveEnd);
    } else {
      void import("@/lib/cityLightsLayer").then(({ CITY_LIGHTS_LAYER }) => {
        if (map.current?.getLayer(CITY_LIGHTS_LAYER)) map.current.removeLayer(CITY_LIGHTS_LAYER);
      });
    }
    return () => {
      alive = false;
      instance.off("moveend", onMoveEnd);
      instance.off("idle", onIdle);
    };
  }, [cityLights, loaded, styleRev]);

  useEffect(() => {
    lights.current?.setEvents(events, liveIds, selectedId, Date.now());
  }, [events, liveIds, selectedId, cityLights, loaded]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !loaded) return;
    const onSettle = (e: unknown) => {
      if (!isHopFrame(e)) setViewRev((n) => n + 1);
    };
    instance.on("moveend", onSettle);
    return () => {
      instance.off("moveend", onSettle);
    };
  }, [loaded]);

  // Reconcile markers against the event list: add what is new, drop what is
  // gone, and leave untouched pins alone so they do not flicker on refetch.
  // Only pins in (or just around) the view are drawn, the soonest MAX_PINS of
  // them: every pin is a DOM element the browser moves on each frame.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !loaded) return;

    const b = instance.getBounds();
    const padLat = (b.getNorth() - b.getSouth()) * 0.15;
    const padLng = (b.getEast() - b.getWest()) * 0.15;
    const candidates = events.filter(
      (e) =>
        e.lat != null &&
        e.lng != null &&
        (e.id === selectedId ||
          (e.lat >= b.getSouth() - padLat &&
            e.lat <= b.getNorth() + padLat &&
            e.lng >= b.getWest() - padLng &&
            e.lng <= b.getEast() + padLng)),
    );

    // Zoomed out over a busy city, nearby events share one numbered marker;
    // zoomed in (or when there are few), every event gets its own pin.
    const crowded = instance.getZoom() < CLUSTER_UNTIL_ZOOM && candidates.length > CLUSTER_FROM;
    const grouped = crowded
      ? gridCluster(
          candidates.map((e) => {
            const pt = instance.project([e.lng!, e.lat!]);
            return { item: e, x: pt.x, y: pt.y };
          }),
          CLUSTER_CELL,
          (e) => e.id === selectedId,
        )
      : { singles: candidates, clusters: [] };

    const inView = grouped.singles
      .sort((a, z) => (a.id === selectedId ? -1 : z.id === selectedId ? 1 : a.start_time.localeCompare(z.start_time)))
      .slice(0, MAX_PINS);

    const wantedClusters = new Set<string>();
    for (const c of grouped.clusters) {
      const key = `c:${c.key}:${c.items.length}`;
      wantedClusters.add(key);
      if (clusterMarkers.current.has(key)) continue;
      const lng = c.items.reduce((s, e) => s + e.lng!, 0) / c.items.length;
      const lat = c.items.reduce((s, e) => s + e.lat!, 0) / c.items.length;
      // The cluster wears the colour of its most common category.
      const tally = new Map<string, number>();
      c.items.forEach((e) => tally.set(e.category, (tally.get(e.category) ?? 0) + 1));
      const top = [...tally.entries()].sort((x, y) => y[1] - x[1])[0][0] as Event["category"];
      const anchor = document.createElement("div");
      anchor.className = "pin-anchor";
      const el = document.createElement("button");
      el.type = "button";
      el.className = "pin-cluster";
      el.style.setProperty("--pin-hue", getCategoryColorFixed(top).color);
      el.textContent = String(c.items.length);
      el.setAttribute("aria-label", `${c.items.length} events here. Zoom in`);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const box = new LngLatBounds();
        c.items.forEach((e) => box.extend([e.lng!, e.lat!]));
        instance.fitBounds(box, { padding: 80, maxZoom: CLUSTER_UNTIL_ZOOM + 1, duration: prefersReducedMotion() ? 0 : 600 });
      });
      anchor.appendChild(el);
      clusterMarkers.current.set(
        key,
        new Marker({ element: anchor, anchor: "center", rotationAlignment: "viewport", pitchAlignment: "viewport" })
          .setLngLat([lng, lat])
          .addTo(instance),
      );
    }
    for (const [key, marker] of clusterMarkers.current) {
      if (!wantedClusters.has(key)) {
        marker.remove();
        clusterMarkers.current.delete(key);
      }
    }

    const wanted = new Set<string>();

    for (const event of inView) {
      if (event.lat == null || event.lng == null) continue;
      wanted.add(event.id);
      if (markers.current.has(event.id)) continue;

      const hue = getCategoryColorFixed(event.category);

      // MapLibre owns the marker element's position and transform (it writes
      // an inline translate on every frame). Keep that element bare and put
      // all styling, hover scale and transitions on an inner button, or the
      // pin drifts away from its coordinate while the map moves.
      const anchor = document.createElement("div");
      anchor.className = "pin-anchor";
      anchor.style.setProperty("--pin-hue", hue.color);

      const el = document.createElement("button");
      el.type = "button";
      el.className = "pin pin-cat";
      el.style.setProperty("--pin-hue", hue.color);
      el.style.setProperty("--pin-halo", hue.halo);
      el.setAttribute("aria-label", event.title);
      const dot =
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="5"/></svg>';
      if (event.image_url) {
        // Thumbnail pin: the event's image in a ring of its category colour.
        // Falls back to the plain dot if the image will not load.
        el.classList.add("pin-thumb");
        const img = document.createElement("img");
        img.src = sized(event.image_url, 64) ?? event.image_url;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.draggable = false;
        img.addEventListener("error", () => {
          el.classList.remove("pin-thumb");
          el.innerHTML = dot;
        });
        el.appendChild(img);
      } else {
        el.innerHTML = dot;
      }
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
  }, [events, loaded, viewRev, selectedId]);

  // List and map are one surface: pointing at an event in the list lifts its pin.
  useEffect(() => {
    for (const [id, marker] of markers.current) marker.getElement().classList.toggle("is-hover", id === hoverId);
  }, [hoverId, viewRev, events]);

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
    // Keep the route clear of the event card, wherever the layout put it:
    // beside the route on wide maps, across the bottom on phones.
    const c = instance.getContainer().getBoundingClientRect();
    const pad = { top: 110, bottom: 50, left: 50, right: 70 };
    const card = document.querySelector(".map-peek")?.getBoundingClientRect();
    if (card && card.width > 0) {
      if (card.width < c.width * 0.6) pad.left = Math.max(pad.left, card.right - c.left + 30);
      else pad.bottom = Math.max(pad.bottom, c.bottom - card.top + 30);
    }
    // MapLibre refuses to fit when padding leaves no room; keep a strip free.
    pad.bottom = Math.min(pad.bottom, Math.max(50, c.height - pad.top - 80));
    pad.left = Math.min(pad.left, Math.max(50, c.width - pad.right - 80));
    instance.fitBounds(b, {
      padding: pad,
      maxZoom: 15,
      duration: prefersReducedMotion() ? 0 : 900,
    });
  }, [route, loaded, styleRev]);

  // Active pin styling lives outside the reconcile pass so selecting an event
  // never rebuilds markers.
  useEffect(() => {
    for (const [id, marker] of markers.current) {
      marker.getElement().classList.toggle("is-active", id === selectedId);
      marker.getElement().classList.toggle("is-live", liveIds?.has(id) ?? false);
    }
  }, [selectedId, events, liveIds, viewRev]);

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
            <path d="M12 3l3.5 9h-7z" fill="var(--signal)" />
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
