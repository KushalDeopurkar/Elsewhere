"use client";

/**
 * "City lights" on the real map: a three.js layer drawn inside MapLibre's
 * own WebGL context, georeferenced in metres. Street lights are sampled
 * from the actual road lines in the loaded vector tiles (warm on main
 * roads, cool on side streets), and every event is a beam of light rising
 * from its real venue, coloured by category, taller the sooner it starts.
 * Buildings (MapLibre's fill-extrusions) share the depth buffer, so the
 * skyline hides lights behind it.
 *
 * Desktop only (the caller decides). It repaints continuously while shown,
 * so it is removed from the map when switched off.
 */
import * as THREE from "three";
import { MercatorCoordinate, type CustomLayerInterface, type MapLibreMap } from "maplibre-gl";
import type { Event } from "./types";
import { getCategoryColor } from "./categoryColors";
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
  /** Screen-space hit test for event beams: returns the event under (x, y) CSS px, if any. */
  pick: (x: number, y: number) => Event | null;
  /** Re-sample the streets around the current view (call after the map settles somewhere new). */
  refreshStreets: () => void;
}

export function createCityLights(map: MapLibreMap): CityLights {
  let renderer: THREE.WebGLRenderer | null = null;
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const streetMat = pointsMaterial(false);
  const headMat = pointsMaterial(true);
  const beamMat = pointsMaterial(false);

  let origin = MercatorCoordinate.fromLngLat(map.getCenter(), 0);
  let scale = origin.meterInMercatorCoordinateUnits();
  let streets: THREE.Points | null = null;
  let heads: THREE.Points | null = null;
  let beams: THREE.Points | null = null;
  let beaconEvents: Event[] = [];
  let beaconPos: Float32Array = new Float32Array(0);
  let lastEvents: { events: Event[]; live: ReadonlySet<string> | null; sel: string | null; now: number } = { events: [], live: null, sel: null, now: 0 };
  const clock = new THREE.Clock();
  let intro = 0;
  const mvp = new THREE.Matrix4();

  const toLocal = (lng: number, lat: number): [number, number] => {
    const m = MercatorCoordinate.fromLngLat([lng, lat], 0);
    return [(m.x - origin.x) / scale, (m.y - origin.y) / scale];
  };

  const dispose = (o: THREE.Points | null) => {
    if (!o) return;
    scene.remove(o);
    o.geometry.dispose();
  };

  /** Beam height in metres: tall enough to read at city zoom, by how soon it starts. */
  const heightFor = (e: Event, live: boolean, now: number) => {
    const hrs = (Date.parse(e.start_time) - now) / 3_600_000;
    return live || hrs <= 0 ? 2000 : hrs <= 24 ? 1500 : hrs <= 72 ? 1000 : 650;
  };

  function buildBeacons() {
    dispose(heads);
    dispose(beams);
    const { events, live, sel, now } = lastEvents;
    const list = events.filter((e) => e.lat != null && e.lng != null);
    beaconEvents = list;
    const n = list.length;
    const hPos = new Float32Array(n * 3);
    const hCol = new Float32Array(n * 3);
    const hSize = new Float32Array(n);
    const hPh = new Float32Array(n);
    // Each beam is a column of soft points (WebGL lines are 1px thin), with
    // a pool of light where it meets the ground.
    const STEPS = 30;
    const per = STEPS + 1;
    const bPos = new Float32Array(n * per * 3);
    const bCol = new Float32Array(n * per * 3);
    const bSize = new Float32Array(n * per);
    const bPh = new Float32Array(n * per);
    list.forEach((e, i) => {
      const [x, y] = toLocal(e.lng!, e.lat!);
      const isLive = live?.has(e.id) ?? false;
      const h = heightFor(e, isLive, now);
      const c = cssColor(getCategoryColor(e.category).color);
      hPos.set([x, y, h], i * 3);
      hCol.set([c.r, c.g, c.b], i * 3);
      hSize[i] = e.id === sel ? 40 : isLive ? 32 : 26;
      hPh[i] = (i * 1.7) % 6.28;
      const k = e.id === sel ? 1.25 : 1;
      for (let j = 0; j < STEPS; j++) {
        const f = j / (STEPS - 1);
        const o = (i * per + j) * 3;
        bPos.set([x, y, h * f], o);
        const fade = (1 - f * 0.75) * k;
        bCol.set([c.r * fade, c.g * fade, c.b * fade], o);
        bSize[i * per + j] = (e.id === sel ? 13 : 10) * (1 - f * 0.45);
        bPh[i * per + j] = hPh[i];
      }
      const g = (i * per + STEPS) * 3;
      bPos.set([x, y, 2], g);
      bCol.set([c.r * 0.55, c.g * 0.55, c.b * 0.55], g);
      bSize[i * per + STEPS] = e.id === sel ? 90 : 64;
      bPh[i * per + STEPS] = hPh[i];
    });
    beaconPos = hPos;
    const hg = new THREE.BufferGeometry();
    hg.setAttribute("position", new THREE.BufferAttribute(hPos, 3));
    hg.setAttribute("aColor", new THREE.BufferAttribute(hCol, 3));
    hg.setAttribute("aSize", new THREE.BufferAttribute(hSize, 1));
    hg.setAttribute("aPhase", new THREE.BufferAttribute(hPh, 1));
    heads = new THREE.Points(hg, headMat);
    heads.frustumCulled = false;
    scene.add(heads);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    bg.setAttribute("aColor", new THREE.BufferAttribute(bCol, 3));
    bg.setAttribute("aSize", new THREE.BufferAttribute(bSize, 1));
    bg.setAttribute("aPhase", new THREE.BufferAttribute(bPh, 1));
    beams = new THREE.Points(bg, beamMat);
    beams.frustumCulled = false;
    scene.add(beams);
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
      dispose(streets);
      dispose(heads);
      dispose(beams);
      streets = heads = beams = null;
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
      streetMat.uniforms.uOpacity.value = intro * far;
      headMat.uniforms.uScale.value = Math.max(0.6, z);
      headMat.uniforms.uTime.value = t;
      headMat.uniforms.uOpacity.value = far;
      beamMat.uniforms.uScale.value = Math.max(0.6, z);
      beamMat.uniforms.uTime.value = t;
      beamMat.uniforms.uOpacity.value = 0.85 * far;

      const model = new THREE.Matrix4().makeTranslation(origin.x, origin.y, 0).scale(new THREE.Vector3(scale, scale, scale));
      mvp.fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]).multiply(model);
      camera.projectionMatrix = mvp;
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
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
    pick(x, y) {
      if (!beaconEvents.length) return null;
      const canvas = map.getCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const v = new THREE.Vector4();
      let best = -1;
      let bestD = 18 * 18;
      for (let i = 0; i < beaconEvents.length; i++) {
        // Test against the beam's top and its foot, whichever is nearer.
        for (const zz of [beaconPos[i * 3 + 2], beaconPos[i * 3 + 2] * 0.5]) {
          v.set(beaconPos[i * 3], beaconPos[i * 3 + 1], zz, 1).applyMatrix4(mvp);
          if (v.w <= 0) continue;
          const sx = ((v.x / v.w + 1) / 2) * w;
          const sy = ((1 - v.y / v.w) / 2) * h;
          const d = (sx - x) ** 2 + (sy - y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
      return best >= 0 ? beaconEvents[best] : null;
    },
  };
}

export const CITY_LIGHTS_LAYER = LAYER_ID;
