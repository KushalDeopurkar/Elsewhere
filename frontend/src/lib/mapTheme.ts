import type { MapLibreMap } from "maplibre-gl";

/**
 * The basemap is OpenFreeMap's published style, re-themed at runtime.
 *
 * An earlier version hand-authored a style against a guessed TileJSON
 * endpoint (tiles.openfreemap.org/planet). That URL is not part of their
 * documented API, so the source never resolved and the map failed to load.
 * Loading the style they actually publish means the source, glyph and sprite
 * URLs are whatever OpenFreeMap serves, and cannot drift out from under us.
 *
 * The cost is that the published styles are light, so we repaint them. The
 * repaint is driven by layer type with id heuristics on top, which degrades
 * gracefully: a layer we do not recognise still gets a sensible dark fill
 * rather than staying white.
 *
 * Tiles, glyphs and sprites are keyless and unmetered.
 */

export const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE ||
  "https://tiles.openfreemap.org/styles/liberty";

/**
 * Second keyless provider, tried once if the first never loads. One basemap
 * host being unreachable should degrade the map's looks, not remove it.
 */
export const FALLBACK_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_FALLBACK ||
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/** App tokens as hex, since the MapLibre style spec does not parse oklch(). */
const C = {
  base: "#181411",
  land: "#1f1b17",
  water: "#172934",
  park: "#1c2e20",
  roadMinor: "#28241f",
  roadMajor: "#322d27",
  roadTrunk: "#443d36",
  buildingLow: "#272320",
  buildingHigh: "#4a423a",
  label: "#c7c3c0",
  labelHalo: "#120f0d",
  boundary: "#453e37",
};

const has = (id: string, ...needles: string[]) =>
  needles.some((n) => id.toLowerCase().includes(n));

/** Set a paint property, ignoring layers that do not support it. */
function paint(
  map: MapLibreMap,
  id: string,
  prop: string,
  value: unknown,
): void {
  try {
    map.setPaintProperty(id, prop as never, value as never);
  } catch {
    // Layer does not carry this property. Expected across a style we did not
    // author, and not worth failing the repaint over.
  }
}

function fillColorFor(id: string): string {
  if (has(id, "water", "ocean", "sea", "river", "lake")) return C.water;
  if (has(id, "park", "wood", "forest", "grass", "garden", "pitch", "green"))
    return C.park;
  if (has(id, "building")) return C.buildingLow;
  return C.land;
}

function lineColorFor(id: string): string {
  if (has(id, "motorway", "trunk", "primary", "highway")) return C.roadTrunk;
  if (has(id, "secondary", "tertiary")) return C.roadMajor;
  if (has(id, "boundary", "admin", "border")) return C.boundary;
  if (has(id, "water", "river", "stream", "canal")) return C.water;
  return C.roadMinor;
}

/** Repaint a light basemap to the app's dark palette, in place. */
export function applyDarkTheme(map: MapLibreMap): void {
  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    const { id, type } = layer;

    switch (type) {
      case "background":
        paint(map, id, "background-color", C.base);
        break;
      case "fill":
        paint(map, id, "fill-color", fillColorFor(id));
        paint(map, id, "fill-outline-color", C.base);
        break;
      case "line":
        paint(map, id, "line-color", lineColorFor(id));
        break;
      case "symbol":
        paint(map, id, "text-color", C.label);
        paint(map, id, "text-halo-color", C.labelHalo);
        paint(map, id, "text-halo-width", 1.3);
        paint(map, id, "icon-opacity", 0.55);
        break;
      case "fill-extrusion":
        // The style's own extrusions, if any, are replaced by ours below.
        paint(map, id, "fill-extrusion-opacity", 0);
        break;
      case "raster":
        paint(map, id, "raster-brightness-max", 0.35);
        paint(map, id, "raster-saturation", -0.6);
        break;
      default:
        break;
    }
  }
}

/** Name of the first vector source in the style, whatever the style calls it. */
function vectorSourceId(map: MapLibreMap): string | null {
  const sources = map.getStyle()?.sources ?? {};
  for (const [id, src] of Object.entries(sources)) {
    if ((src as { type?: string })?.type === "vector") return id;
  }
  return null;
}

const BUILDING_SOURCE_LAYERS = ["building", "buildings"];

/**
 * Extrude buildings into real 3D.
 *
 * Heights come from the OpenMapTiles `render_height` field, which the
 * OpenFreeMap tiles carry. Buildings fade in from z15 so the city rises as you
 * zoom into a neighbourhood, and taller ones lighten so the skyline has depth.
 */
export function add3DBuildings(map: MapLibreMap): boolean {
  const source = vectorSourceId(map);
  if (!source) return false;

  for (const sourceLayer of BUILDING_SOURCE_LAYERS) {
    try {
      map.addLayer({
        id: "pulse-buildings-3d",
        type: "fill-extrusion",
        source,
        "source-layer": sourceLayer,
        minzoom: 14,
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "render_height"], ["get", "height"], 8],
            0, C.buildingLow,
            60, C.buildingHigh,
          ],
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14, 0,
            16, ["coalesce", ["get", "render_height"], ["get", "height"], 8],
          ],
          "fill-extrusion-base": [
            "coalesce",
            ["get", "render_min_height"],
            ["get", "min_height"],
            0,
          ],
          "fill-extrusion-opacity": 0.9,
        },
      });
      return true;
    } catch {
      // Wrong source-layer name for this style; try the next candidate.
    }
  }
  return false;
}

/** Camera used on first paint and by the reset control. */
export const DEFAULT_VIEW = {
  center: [72.8777, 19.076] as [number, number],
  zoom: 12.2,
  pitch: 55,
  bearing: -18,
};
