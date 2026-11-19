"use client";

/**
 * "City lights" on the real map: a three.js layer drawn inside MapLibre's
 * own WebGL context, georeferenced in metres. Street lights are sampled
 * from the actual road lines in the loaded vector tiles (warm on main
 * roads, cool on side streets), and every event sends soft rings of
 * light rippling across the ground from its real venue, in its category
 * colour (brighter and faster when it's on now or selected). The photo
 * pins float above the ripples (styled in CSS).
 * Buildings (MapLibre's fill-extrusions) share the depth buffer, so the
 * skyline hides lights behind it.
 *
 * Desktop only (the caller decides). It repaints continuously while shown,
 * so it is removed from the map when switched off.
 */
import * as THREE from "three";
import { MercatorCoordinate, type CustomLayerInterface, type MapLibreMap } from "maplibre-gl";
import type { Event } from "./types";
import { getCategoryColorFixed } from "./categoryColors";
import { vectorSourceId } from "./mapTheme";

const LAYER_ID = "ee-city-lights";
const MAX_LIGHTS = 26000;
const RADIUS_M = 16000;
const MAJOR = new Set(["motorway", "trunk", "primary", "secondary"]);

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uScale;
  uniform float uTime;
  uniform float uPulse;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    float tw = uPulse > 0.5 ? 0.75 + 0.25 * sin(uTime * 2.2 + aPhase) : 0.85 + 0.15 * sin(uTime * 0.7 + aPhase);
    vAlpha = tw;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale * (uPulse > 0.5 ? tw : 1.0);
  }
`;
const FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float a = pow(core, 1.6) * vAlpha * uOpacity;
    gl_FragColor = vec4(vColor * (0.6 + core), a);
  }
`;

// Ground ripples: one quad per event lying flat on the map; the fragment
// shader draws two expanding rings and a soft core.
const RIPPLE_VERT = /* glsl */ `
  attribute vec2 aCenter;
  attribute vec2 aCorner;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aBoost;
  uniform float uRadius;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPhase;
  varying float vBoost;
  void main() {
    vUv = aCorner;
    vColor = aColor;
    vPhase = aPhase;
    vBoost = aBoost;
    vec3 p = vec3(aCenter + aCorner * uRadius * (1.0 + 0.4 * aBoost), 2.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const RIPPLE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPhase;
  varying float vBoost;
  float ring(float d, float r, float w) { return smoothstep(w, 0.0, abs(d - r)); }
  void main() {
    float d = length(vUv);
    if (d > 1.0) discard;
    // One thin ring drifting outward, plus a small steady dot at the venue.
    // Kept faint on purpose: only live and selected events stand out.
    float t = fract(uTime * (0.22 + 0.18 * vBoost) + vPhase);
    float ring = smoothstep(0.05, 0.0, abs(d - t)) * (1.0 - t);
    float dot = smoothstep(0.13, 0.07, d);
    float a = (ring * (0.4 + 0.4 * vBoost) + dot * (0.55 + 0.3 * vBoost)) * uOpacity;
    gl_FragColor = vec4(vColor, a);
  }
`;

const pointsMaterial = (pulse: boolean) =>
  new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 }, uTime: { value: 0 }, uPulse: { value: pulse ? 1 : 0 }, uOpacity: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });

const colorCache = new Map<string, THREE.Color>();
function cssColor(css: string): THREE.Color {
  const hit = colorCache.get(css);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  const col = new THREE.Color(r / 255, g / 255, b / 255);
  colorCache.set(css, col);
  return col;
}

export interface CityLights {
  layer: CustomLayerInterface;
  setEvents: (events: Event[], liveIds: ReadonlySet<string> | null, selectedId: string | null, now: number) => void;
  /** Re-sample the streets around the current view (call after the map settles somewhere new). */
  refreshStreets: () => void;
}

export function createCityLights(map: MapLibreMap): CityLights {
  let renderer: THREE.WebGLRenderer | null = null;
  let pending = 0;
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const streetMat = pointsMaterial(false);
  const rippleMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uRadius: { value: 300 } },
    vertexShader: RIPPLE_VERT,
    fragmentShader: RIPPLE_FRAG,
    transparent: true,
    depthWrite: false,
    // Local y runs south, which flips the quads' winding: draw both faces.
    side: THREE.DoubleSide,
    // Normal blending: overlapping venues don't add up into white blobs.
    blending: THREE.NormalBlending,
  });

  let origin = MercatorCoordinate.fromLngLat(map.getCenter(), 0);
  let scale = origin.meterInMercatorCoordinateUnits();
  let streets: THREE.Points | null = null;
  let ripples: THREE.Mesh | null = null;
  let lastEvents: { events: Event[]; live: ReadonlySet<string> | null; sel: string | null; now: number } = { events: [], live: null, sel: null, now: 0 };
  const clock = new THREE.Clock();
  let intro = 0;
  const mvp = new THREE.Matrix4();

  const toLocal = (lng: number, lat: number): [number, number] => {
    const m = MercatorCoordinate.fromLngLat([lng, lat], 0);
    return [(m.x - origin.x) / scale, (m.y - origin.y) / scale];
  };

  const dispose = (o: THREE.Points | THREE.Mesh | null) => {
    if (!o) return;
    scene.remove(o);
    o.geometry.dispose();
  };

  function buildBeacons() {
    dispose(ripples);
    ripples = null;
    const { events, live, sel } = lastEvents;
    const list = events.filter((e) => e.lat != null && e.lng != null);
    const n = list.length;
    if (!n) return;
    const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
    const center = new Float32Array(n * 8);
    const corner = new Float32Array(n * 8);
    const color = new Float32Array(n * 12);
    const phase = new Float32Array(n * 4);
    const boost = new Float32Array(n * 4);
    const index: number[] = [];
    list.forEach((e, i) => {
      const [x, y] = toLocal(e.lng!, e.lat!);
      const c = cssColor(getCategoryColorFixed(e.category).color);
      const b = e.id === sel ? 1 : live?.has(e.id) ? 0.7 : 0;
      for (let v = 0; v < 4; v++) {
        const k = i * 4 + v;
        center[k * 2] = x;
        center[k * 2 + 1] = y;
        corner[k * 2] = corners[v * 2];
        corner[k * 2 + 1] = corners[v * 2 + 1];
        color[k * 3] = c.r;
        color[k * 3 + 1] = c.g;
        color[k * 3 + 2] = c.b;
        phase[k] = (i * 0.618) % 1;
        boost[k] = b;
      }
      const o = i * 4;
      index.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    const g = new THREE.BufferGeometry();
    // three wants a "position" attribute; the shader places vertices itself.
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 12), 3));
    g.setAttribute("aCenter", new THREE.BufferAttribute(center, 2));
    g.setAttribute("aCorner", new THREE.BufferAttribute(corner, 2));
    g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aBoost", new THREE.BufferAttribute(boost, 1));
    g.setIndex(index);
    ripples = new THREE.Mesh(g, rippleMat);
    ripples.frustumCulled = false;
    scene.add(ripples);
    map.triggerRepaint();
  }

  function buildStreets() {
    const source = vectorSourceId(map);
    if (!source) return;
    let feats: ReturnType<MapLibreMap["querySourceFeatures"]> = [];
    try {
      feats = map.querySourceFeatures(source, { sourceLayer: "transportation" });
    } catch {
      return;
    }
    if (!feats.length) return;
    const pos: number[] = [];
    const col: number[] = [];
    const size: number[] = [];
    const ph: number[] = [];
    const warm = new THREE.Color("#ffb37a");
    const cool = new THREE.Color("#8f9bd8");
    let count = 0;
    const seen = new Set<string>();
    outer: for (const f of feats) {
      const cls = String(f.properties?.class ?? "");
      if (cls === "path" || cls === "track" || cls === "rail" || cls === "transit" || cls === "ferry") continue;
      const major = MAJOR.has(cls);
      const step = major ? 55 : 85;
      const lines =
        f.geometry.type === "LineString"
          ? [f.geometry.coordinates as number[][]]
          : f.geometry.type === "MultiLineString"
            ? (f.geometry.coordinates as number[][][])
            : [];
      for (const line of lines) {
        let carry = 0;
        for (let i = 1; i < line.length; i++) {
          const [ax, ay] = toLocal(line[i - 1][0], line[i - 1][1]);
          const [bx, by] = toLocal(line[i][0], line[i][1]);
          const len = Math.hypot(bx - ax, by - ay);
          if (len === 0) continue;
          let t = carry;
          while (t < len) {
            const x = ax + ((bx - ax) * t) / len;
            const y = ay + ((by - ay) * t) / len;
            t += step;
            if (x * x + y * y > RADIUS_M * RADIUS_M) continue;
            // Tiles overlap at their edges; skip near-duplicates.
            const key = `${Math.round(x / 20)},${Math.round(y / 20)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const c = major ? warm : cool;
            const k = major ? 1 : 0.55 + ((count * 7) % 10) / 25;
            pos.push(x, y, major ? 6 : 3);
            col.push(c.r * k, c.g * k, c.b * k);
            size.push(major ? 3.2 : 2.2);
            ph.push((count * 0.37) % 6.28);
            if (++count >= MAX_LIGHTS) break outer;
          }
          carry = t - len;
        }
      }
    }
    dispose(streets);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(col), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(size), 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(ph), 1));
    streets = new THREE.Points(g, streetMat);
    streets.frustumCulled = false;
    scene.add(streets);
    intro = 0;
    map.triggerRepaint();
  }

  /** Re-centre the local frame when the view has wandered far from it. */
  function recentre() {
    const c = MercatorCoordinate.fromLngLat(map.getCenter(), 0);
    if (Math.hypot(c.x - origin.x, c.y - origin.y) / scale < 6000) return false;
    origin = c;
    scale = origin.meterInMercatorCoordinateUnits();
    return true;
  }

  const layer: CustomLayerInterface = {
    id: LAYER_ID,
    type: "custom",
    renderingMode: "3d",
    onAdd(m, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      clock.start();
      buildStreets();
      buildBeacons();
    },
    onRemove() {
      window.clearTimeout(pending);
      pending = 0;
      dispose(streets);
      dispose(ripples);
      streets = null;
      ripples = null;
      renderer?.dispose();
      renderer = null;
    },
    render(_gl, args) {
      if (!renderer) return;
      const t = clock.getElapsedTime();
      intro = Math.min(1, intro + 0.02);
      const zoom = map.getZoom();
      // Point sprites shrink as you zoom out, so a whole city doesn't blur into one glow.
      const z = Math.min(1.6, Math.max(0.35, Math.pow(2, (zoom - 12.5) * 0.45))) * window.devicePixelRatio;
      // Far out (the fly between cities) the street lights fade away.
      const far = Math.min(1, Math.max(0, (zoom - 8.5) / 2));
      streetMat.uniforms.uScale.value = z;
      streetMat.uniforms.uTime.value = t;
      streetMat.uniforms.uOpacity.value = 0.75 * intro * far;
      // Ripples hold a modest size on screen (~45px across) at any zoom and
      // fade out when zoomed out to the whole metro, where they'd crowd.
      rippleMat.uniforms.uRadius.value = 560 * Math.pow(2, 12.5 - zoom);
      rippleMat.uniforms.uTime.value = t;
      rippleMat.uniforms.uOpacity.value = Math.min(1, Math.max(0, (zoom - 10.2) / 1.3));

      const model = new THREE.Matrix4().makeTranslation(origin.x, origin.y, 0).scale(new THREE.Vector3(scale, scale, scale));
      mvp.fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]).multiply(model);
      camera.projectionMatrix = mvp;
      renderer.resetState();
      renderer.render(scene, camera);
      // The ripples need a steady redraw, but the pulse is slow: ~30 fps looks
      // the same and leaves the main thread half free.
      if (!pending) pending = window.setTimeout(() => ((pending = 0), map.triggerRepaint()), 33);
    },
  };

  return {
    layer,
    setEvents(events, liveIds, selectedId, now) {
      lastEvents = { events, live: liveIds, sel: selectedId, now };
      if (renderer) buildBeacons();
    },
    refreshStreets() {
      if (!renderer) return;
      if (recentre()) buildBeacons();
      buildStreets();
    },
  };
}

export const CITY_LIGHTS_LAYER = LAYER_ID;
