import type { StyleSpecification } from "maplibre-gl";

/**
 * Hand-authored dark basemap.
 *
 * Built against the OpenMapTiles schema so the `building` layer carries
 * `render_height`, which is what makes the 3D extrusion possible. Vector
 * tiles, glyphs and the style are all keyless, so the map needs no account
 * and no billing to run.
 *
 * Colors are the app's own tokens converted to hex, because the MapLibre
 * style spec does not parse oklch().
 */

export const TILE_SOURCE =
  process.env.NEXT_PUBLIC_MAP_TILES || "https://tiles.openfreemap.org/planet";

const GLYPHS =
  process.env.NEXT_PUBLIC_MAP_GLYPHS ||
  "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

const C = {
  base: "#181411",
  land: "#1f1b17",
  water: "#172934",
  park: "#1c2e20",
  roadMinor: "#28241f",
  roadMajor: "#322d27",
  roadTrunk: "#3f3933",
  buildingLow: "#28241f",
  buildingHigh: "#4a423a",
  label: "#c7c3c0",
  labelHalo: "#181411",
  boundary: "#3f3933",
};

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS,
  sources: {
    omt: { type: "vector", url: TILE_SOURCE },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": C.base } },
    {
      id: "land",
      type: "fill",
      source: "omt",
      "source-layer": "globallandcover",
      paint: { "fill-color": C.land, "fill-opacity": 0.5 },
    },
    {
      id: "park",
      type: "fill",
      source: "omt",
      "source-layer": "park",
      paint: { "fill-color": C.park, "fill-opacity": 0.7 },
    },
    {
      id: "water",
      type: "fill",
      source: "omt",
      "source-layer": "water",
      paint: { "fill-color": C.water },
    },
    {
      id: "road-minor",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["in", "class", "minor", "service", "track", "path"],
      minzoom: 12,
      paint: {
        "line-color": C.roadMinor,
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 0.5, 18, 6],
      },
    },
    {
      id: "road-major",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["in", "class", "secondary", "tertiary"],
      paint: {
        "line-color": C.roadMajor,
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 9, 0.6, 18, 10],
      },
    },
    {
      id: "road-trunk",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["in", "class", "motorway", "trunk", "primary"],
      paint: {
        "line-color": C.roadTrunk,
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 6, 0.8, 18, 16],
      },
    },
    {
      id: "boundary",
      type: "line",
      source: "omt",
      "source-layer": "boundary",
      filter: ["<=", "admin_level", 4],
      paint: { "line-color": C.boundary, "line-dasharray": [3, 2], "line-width": 0.8 },
    },
    {
      // The 3D. Extrusions fade in at z15 so the city rises as you zoom to a
      // neighbourhood, and taller buildings lighten so the skyline has depth.
      id: "building-3d",
      type: "fill-extrusion",
      source: "omt",
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "render_height"], 8],
          0, C.buildingLow,
          60, C.buildingHigh,
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14, 0,
          16, ["coalesce", ["get", "render_height"], 8],
        ],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.85,
      },
    },
    {
      id: "place-label",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      filter: ["in", "class", "city", "town", "suburb", "neighbourhood"],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 15, 15],
        "text-letter-spacing": 0.04,
        "text-max-width": 8,
      },
      paint: {
        "text-color": C.label,
        "text-halo-color": C.labelHalo,
        "text-halo-width": 1.4,
      },
    },
  ],
};

/** Camera used on first paint and by the reset control. */
export const DEFAULT_VIEW = {
  center: [72.8777, 19.076] as [number, number],
  zoom: 12.2,
  pitch: 55,
  bearing: -18,
};
