"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "@phosphor-icons/react/ssr";
import { LngLatBounds, MapLibreMap, Marker, setWorkerUrl } from "maplibre-gl";
import { STYLE_URL, FALLBACK_STYLE_URL, applyDarkTheme } from "@/lib/mapTheme";
import type { PlanStop } from "@/lib/plan";
import { pathTo, pointAt, stopIndexAt, type LngLat } from "@/lib/route";
import { whenOf } from "@/lib/formatDate";

setWorkerUrl("/maplibre-gl-worker.mjs");

const ROUTE_SOURCE = "plan-route";

const located = (list: PlanStop[]) =>
  list.filter((s) => s.event.lat != null && s.event.lng != null);

function draw(instance: MapLibreMap, list: PlanStop[], markers: { current: Marker[] }) {
  markers.current.forEach((m) => m.remove());
  markers.current = [];

  const pts = located(list);
  // Several venues can share one point (events stored at a city centre).
  // Fan those pins out by a fixed pixel offset so every number stays visible.
  const seen: { lat: number; lng: number; n: number }[] = [];
  pts.forEach((s) => {
    const hit = seen.find(
      (p) => Math.abs(p.lat - s.event.lat!) < 0.0004 && Math.abs(p.lng - s.event.lng!) < 0.0004,
    );
    const dup = hit ? ++hit.n : 0;
    if (!hit) seen.push({ lat: s.event.lat!, lng: s.event.lng!, n: 0 });
    // MapLibre owns the anchor's transform; style the inner badge only.
    const anchor = document.createElement("div");
    const badge = document.createElement("span");
    badge.className = "plan-pin";
    badge.textContent = String(list.indexOf(s) + 1);
    badge.title = s.event.title;
    anchor.appendChild(badge);
    markers.current.push(
      new Marker({ element: anchor, anchor: "center", offset: [dup * 26, dup * -6] })
        .setLngLat([s.event.lng!, s.event.lat!])
        .addTo(instance),
    );
  });

  const line = {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: pts.map((s) => [s.event.lng!, s.event.lat!]),
    },
  };
  const src = instance.getSource(ROUTE_SOURCE) as { setData?: (d: unknown) => void } | undefined;
  if (src?.setData) {
    src.setData(line);
  } else {
    instance.addSource(ROUTE_SOURCE, { type: "geojson", data: line });
    instance.addLayer({
      id: "plan-route-glow",
      type: "line",
      source: ROUTE_SOURCE,
      paint: { "line-color": "#ff6b57", "line-width": 8, "line-opacity": 0.18, "line-blur": 4 },
      layout: { "line-cap": "round", "line-join": "round" },
    });
    instance.addLayer({
      id: "plan-route",
      type: "line",
      source: ROUTE_SOURCE,
      paint: { "line-color": "#ff6b57", "line-width": 3, "line-dasharray": [1.5, 1.5] },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }

  if (pts.length === 1) {
    instance.easeTo({ center: [pts[0].event.lng!, pts[0].event.lat!], zoom: 13.5, duration: 600 });
  } else if (pts.length > 1) {
    const b = new LngLatBounds();
    pts.forEach((s) => b.extend([s.event.lng!, s.event.lat!]));
    instance.fitBounds(b, { padding: 70, maxZoom: 14.5, duration: 800 });
  }
}

/**
 * Numbered stops joined by a dashed route line. Rotate with right-drag or a
 * two-finger twist, like the main map.
 */
const LEG_MS = 1400;

function setRoute(instance: MapLibreMap, coords: LngLat[]) {
  const src = instance.getSource(ROUTE_SOURCE) as { setData?: (d: unknown) => void } | undefined;
  src?.setData?.({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
}

export default function PlanMap({ stops, animate = false }: { stops: PlanStop[]; animate?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const ready = useRef(false);
  const latest = useRef(stops);
  const [failed, setFailed] = useState(false);

  // The style can finish loading after newer stops arrive; keep the latest.
  useEffect(() => {
    latest.current = stops;
  });

  useEffect(() => {
    if (!container.current || map.current) return;
    const first = located(latest.current)[0];
    const instance = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
      center: first ? [first.event.lng!, first.event.lat!] : [72.878, 19.076],
      zoom: 11.5,
      pitch: 35,
      attributionControl: { compact: true },
    });
    map.current = instance;
    let triedFallback = false;

    instance.on("style.load", () => {
      applyDarkTheme(instance);
      ready.current = true;
      draw(instance, latest.current, markers);
    });
    instance.on("error", () => {
      if (ready.current) return;
      if (!triedFallback) {
        triedFallback = true;
        instance.setStyle(FALLBACK_STYLE_URL);
      } else {
        setFailed(true);
      }
    });

    return () => {
      // Removing the map also removes its markers' DOM.
      instance.remove();
      map.current = null;
      ready.current = false;
    };
  }, []);

  // --- Animated route (Plan My Day): a traveller walks the day stop by stop.
  const pts = located(stops);
  const coords: LngLat[] = pts.map((s) => [s.event.lng!, s.event.lat!]);
  const coordsRef = useRef(coords);
  useEffect(() => {
    coordsRef.current = coords;
  });
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const traveler = useRef<Marker | null>(null);
  const progressRef = useRef(0);

  const show = useCallback((t: number) => {
    progressRef.current = t;
    const m = map.current;
    const list = coordsRef.current;
    if (!m || !ready.current || list.length < 2) return;
    setRoute(m, pathTo(list, t));
    const at = pointAt(list, t);
    if (!at) return;
    if (!traveler.current) {
      const el = document.createElement("div");
      el.className = "plan-traveler";
      traveler.current = new Marker({ element: el, anchor: "center" }).setLngLat(at).addTo(m);
    } else {
      traveler.current.setLngLat(at);
    }
  }, []);

  // Play: run from wherever the slider is to the last stop.
  useEffect(() => {
    if (!playing) return;
    const n = coordsRef.current.length;
    let raf = 0;
    let last = performance.now();
    let t = progressRef.current >= n - 1 ? 0 : progressRef.current;
    const step = (now: number) => {
      t = Math.min(n - 1, t + (now - last) / LEG_MS);
      last = now;
      show(t);
      setProgress(t);
      if (t >= n - 1) setPlaying(false);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, show]);

  useEffect(() => {
    if (map.current && ready.current) draw(map.current, stops, markers);
    traveler.current?.remove();
    traveler.current = null;
    if (!animate || located(stops).length < 2) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Wait for the style before the first draw-in.
    let tries = 0;
    const id = window.setInterval(() => {
      if (!ready.current && tries++ < 40) return;
      window.clearInterval(id);
      if (still) {
        const end = located(stops).length - 1;
        show(end);
        setProgress(end);
      } else {
        show(0);
        setProgress(0);
        setPlaying(true);
      }
    }, 150);
    return () => window.clearInterval(id);
  }, [stops, animate, show]);

  const mapEl = (
    <div className="plan-map-box">
      <div ref={container} className="plan-map" aria-label="Map of your plan" role="img" />
      {failed && (
        <div className="plan-map-failed" role="status">
          <p className="plan-map-failed-title">The map couldn&apos;t load here.</p>
          <p>
            {pts.length === 1
              ? "The directions link below opens the exact spot in Google Maps."
              : "Your stops and times are listed below. Each one opens in Google Maps."}
          </p>
        </div>
      )}
    </div>
  );
  if (!animate || pts.length < 2) return mapEl;

  const at = stopIndexAt(progress, pts.length);
  const here = pts[at].event;
  return (
    <div className="plan-map-wrap">
      {mapEl}
      <div className="plan-scrub">
        <button
          type="button"
          className="plan-scrub-play"
          aria-label={playing ? "Pause the day" : "Play the day"}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
        </button>
        <div className="plan-scrub-track">
          <input
            type="range"
            min={0}
            max={(pts.length - 1) * 100}
            step={1}
            value={Math.round(progress * 100)}
            aria-label="Move through the day"
            aria-valuetext={`Stop ${at + 1} of ${pts.length}: ${here.title}`}
            onChange={(e) => {
              setPlaying(false);
              const t = Number(e.target.value) / 100;
              setProgress(t);
              show(t);
            }}
          />
          <p className="plan-scrub-label" aria-live="polite">
            <strong>{at + 1}</strong> {whenOf(here)} · {here.title}
          </p>
        </div>
      </div>
    </div>
  );
}
