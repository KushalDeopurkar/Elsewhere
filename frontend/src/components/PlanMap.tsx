"use client";

import { useEffect, useRef } from "react";
import { LngLatBounds, MapLibreMap, Marker, setWorkerUrl } from "maplibre-gl";
import { STYLE_URL, FALLBACK_STYLE_URL, applyDarkTheme } from "@/lib/mapTheme";
import type { PlanStop } from "@/lib/plan";

setWorkerUrl("/maplibre-gl-worker.mjs");

const ROUTE_SOURCE = "plan-route";

/**
 * Numbered stops joined by a dashed route line. Rotate with right-drag or a
 * two-finger twist, like the main map.
 */
export default function PlanMap({ stops }: { stops: PlanStop[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const ready = useRef(false);
  const latest = useRef(stops);
  latest.current = stops;

  const located = (list: PlanStop[]) =>
    list.filter((s) => s.event.lat != null && s.event.lng != null);

  const draw = (instance: MapLibreMap, list: PlanStop[]) => {
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    const pts = located(list);
    pts.forEach((s) => {
      // MapLibre owns the anchor's transform; style the inner badge only.
      const anchor = document.createElement("div");
      const badge = document.createElement("span");
      badge.className = "plan-pin";
      badge.textContent = String(list.indexOf(s) + 1);
      badge.title = s.event.title;
      anchor.appendChild(badge);
      markers.current.push(
        new Marker({ element: anchor, anchor: "center" })
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
        paint: { "line-color": "#f5b83d", "line-width": 8, "line-opacity": 0.18, "line-blur": 4 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      instance.addLayer({
        id: "plan-route",
        type: "line",
        source: ROUTE_SOURCE,
        paint: { "line-color": "#f5b83d", "line-width": 3, "line-dasharray": [1.5, 1.5] },
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
  };

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
      draw(instance, latest.current);
    });
    instance.on("error", () => {
      if (!ready.current && !triedFallback) {
        triedFallback = true;
        instance.setStyle(FALLBACK_STYLE_URL);
      }
    });

    return () => {
      markers.current.forEach((m) => m.remove());
      instance.remove();
      map.current = null;
      ready.current = false;
    };
  }, []);

  useEffect(() => {
    if (map.current && ready.current) draw(map.current, stops);
  }, [stops]);

  return <div ref={container} className="plan-map" aria-label="Map of your plan" role="img" />;
}
