"use client";

/**
 * 3D night view of the city for the home hero. Street lights are generated;
 * every coloured beacon is a real upcoming event. Hover to peek, click to
 * open, drag to spin. Desktop-only and skipped for reduced motion (the
 * caller decides); decorative for assistive tech, since every event here is
 * also in the lists below.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Event } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { beacons as makeBeacons, cityLights, seedOf, type Beacon } from "@/lib/cityScene";
import { formatWhen } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import { indiaDots } from "@/lib/india";
import { SKY_LIGHTS, type SkyPhase } from "@/lib/sky";

/** India map units for the fly-in: degrees to world units around 78E 22N. */
const MAP_K = 2.6;
const MAP_COS = Math.cos((22 * Math.PI) / 180);
const mapXZ = (lng: number, lat: number): [number, number] => [(lng - 78) * MAP_K * MAP_COS, -(lat - 22) * MAP_K];
const FLY_S = 2.8;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const BG = new THREE.Color("#0e1015");

/** Resolve any CSS colour (oklch included) to RGB through a 1x1 canvas. */
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

const POINT_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixel;
  uniform float uPulse;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float pulse = 1.0 + uPulse * 0.35 * sin(uTime * 2.2 + aPhase);
    gl_PointSize = aSize * pulse * uPixel * (58.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vAlpha = clamp(1.5 - (-mv.z) / 55.0, 0.2, 1.0);
  }
`;
const POINT_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    float a = pow(core, 1.6) * vAlpha * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * (0.6 + core), a);
  }
`;

function pointsMaterial(pulse: number) {
  return new THREE.ShaderMaterial({
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uPixel: { value: 1 },
      uPulse: { value: pulse },
      uOpacity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

interface Hover {
  b: Beacon;
  x: number;
  y: number;
}

export default function CityScene({
  events,
  center,
  cityName,
  onPick,
  sky = "night",
}: {
  events: Event[];
  center: { lat: number; lng: number };
  cityName: string;
  onPick: (e: Event) => void;
  sky?: SkyPhase;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const api = useRef<{
    setData: (b: Beacon[], seed: number) => void;
    fly: (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => void;
  } | null>(null);
  const flyLabel = useRef<HTMLParagraphElement>(null);
  const skyRef = useRef(sky);
  useEffect(() => {
    skyRef.current = sky;
  }, [sky]);
  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  });

  // One renderer for the component's life.
  useEffect(() => {
    const host = wrap.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    let pixel = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(pixel);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(BG, 0.03);
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 200);
    const world = new THREE.Group();
    scene.add(world);

    const lightsMat = pointsMaterial(0);
    const headMat = pointsMaterial(1);
    const beamMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    // Soft ground glow under the city: cool violet fading to coral at the core.
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uOpacity; varying vec2 vUv;
        void main(){ float d = length(vUv - 0.5) * 2.0;
          vec3 c = mix(vec3(1.0,0.42,0.34), vec3(0.42,0.38,1.0), smoothstep(0.0,0.55,d));
          float a = smoothstep(1.0, 0.0, d) * 0.22 * uOpacity;
          gl_FragColor = vec4(c, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), glowMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    world.add(ground);
    // India, drawn in dots, only visible while flying between cities.
    const india = new THREE.Group();
    const indiaMat = pointsMaterial(0);
    {
      const { fill, edge } = indiaDots();
      const all = [...fill.map((p) => [p, 0] as const), ...edge.map((p) => [p, 1] as const)];
      const pos = new Float32Array(all.length * 3);
      const col = new Float32Array(all.length * 3);
      const size = new Float32Array(all.length);
      const dim = new THREE.Color("#7a84c8");
      const rim = new THREE.Color("#a99bff");
      all.forEach(([[lng, lat], isEdge], i) => {
        const [x, z] = mapXZ(lng, lat);
        pos.set([x, 0, z], i * 3);
        const c = isEdge ? rim : dim;
        col.set([c.r, c.g, c.b], i * 3);
        size[i] = isEdge ? 13 : 13;
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
      g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
      g.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(all.length), 1));
      india.add(new THREE.Points(g, indiaMat));
    }
    const ARC_N = 64;
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((ARC_N + 1) * 3), 3));
    const arcMat = new THREE.LineBasicMaterial({ color: "#ff6b57", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const arc = new THREE.Line(arcGeo, arcMat);
    india.add(arc);
    const pinGeo = new THREE.BufferGeometry();
    pinGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    pinGeo.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array([1, 0.55, 0.47, 1, 0.42, 0.34]), 3));
    pinGeo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array([26, 34]), 1));
    pinGeo.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array([0, 1.5]), 1));
    const pinMat = pointsMaterial(1);
    india.add(new THREE.Points(pinGeo, pinMat));
    india.visible = false;
    world.add(india);
    let flight: { t: number; from: [number, number]; to: [number, number] } | null = null;

    const fly = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
      const a = mapXZ(from.lng, from.lat);
      const b = mapXZ(to.lng, to.lat);
      const arr = arcGeo.attributes.position.array as Float32Array;
      const lift = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.35;
      for (let i = 0; i <= ARC_N; i++) {
        const u = i / ARC_N;
        arr.set([a[0] + (b[0] - a[0]) * u, Math.sin(Math.PI * u) * lift, a[1] + (b[1] - a[1]) * u], i * 3);
      }
      arcGeo.attributes.position.needsUpdate = true;
      arcGeo.setDrawRange(0, 0);
      (pinGeo.attributes.position.array as Float32Array).set([a[0], 0.05, a[1], b[0], 0.05, b[1]]);
      pinGeo.attributes.position.needsUpdate = true;
      flight = { t: 0, from: a, to: b };
      india.visible = true;
    };

    let lights: THREE.Points | null = null;
    let heads: THREE.Points | null = null;
    let beams: THREE.LineSegments | null = null;
    let current: Beacon[] = [];
    let intro = 0; // 0..1 fade/rise when data changes

    const setData = (list: Beacon[], seed: number) => {
      for (const o of [lights, heads, beams]) {
        if (o) {
          world.remove(o);
          o.geometry.dispose();
        }
      }
      current = list;
      intro = 0;

      const { positions, glow } = cityLights(seed, 12000);
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const n = glow.length;
      const lSize = new Float32Array(n);
      const lCol = new Float32Array(n * 3);
      const lPh = new Float32Array(n);
      const cool = new THREE.Color("#9aa6d6");
      const warm = new THREE.Color("#ffb38a");
      for (let i = 0; i < n; i++) {
        lSize[i] = 1.1 + glow[i] * 2.2;
        const c = glow[i] > 0.8 ? warm : cool;
        const k = 0.35 + glow[i] * 0.85;
        lCol[i * 3] = c.r * k;
        lCol[i * 3 + 1] = c.g * k;
        lCol[i * 3 + 2] = c.b * k;
      }
      lg.setAttribute("aSize", new THREE.BufferAttribute(lSize, 1));
      lg.setAttribute("aColor", new THREE.BufferAttribute(lCol, 3));
      lg.setAttribute("aPhase", new THREE.BufferAttribute(lPh, 1));
      lights = new THREE.Points(lg, lightsMat);
      world.add(lights);

      const m = list.length;
      const hPos = new Float32Array(m * 3);
      const hCol = new Float32Array(m * 3);
      const hSize = new Float32Array(m);
      const hPh = new Float32Array(m);
      const bPos = new Float32Array(m * 6);
      const bCol = new Float32Array(m * 6);
      list.forEach((b, i) => {
        const c = cssColor(getCategoryColor(b.event.category).color);
        hPos.set([b.x, b.h, b.z], i * 3);
        hCol.set([c.r, c.g, c.b], i * 3);
        hSize[i] = 9;
        hPh[i] = (i * 1.7) % 6.28;
        bPos.set([b.x, 0, b.z, b.x, b.h, b.z], i * 6);
        bCol.set([c.r * 0.9, c.g * 0.9, c.b * 0.9, c.r * 0.15, c.g * 0.15, c.b * 0.15], i * 6);
      });
      const hg = new THREE.BufferGeometry();
      hg.setAttribute("position", new THREE.BufferAttribute(hPos, 3));
      hg.setAttribute("aColor", new THREE.BufferAttribute(hCol, 3));
      hg.setAttribute("aSize", new THREE.BufferAttribute(hSize, 1));
      hg.setAttribute("aPhase", new THREE.BufferAttribute(hPh, 1));
      heads = new THREE.Points(hg, headMat);
      world.add(heads);

      const bg = new THREE.BufferGeometry();
      bg.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
      bg.setAttribute("color", new THREE.BufferAttribute(bCol, 3));
      beams = new THREE.LineSegments(bg, beamMat);
      world.add(beams);
    };
    api.current = { setData, fly };

    // Size and framing: on wide heroes the city sits to the right of the copy.
    let w = 1;
    let h = 1;
    const resize = () => {
      w = host.clientWidth || 1;
      h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      world.position.x = camera.aspect > 1.4 ? 7.5 : 0;
      for (const m of [lightsMat, headMat]) m.uniforms.uPixel.value = pixel;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // Interaction: parallax on move, drag to spin, hover to peek, click to open.
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let spin = 0;
    let spinVel = 0;
    let dragging = false;
    let dragX = 0;
    let moved = 0;
    const ndc = new THREE.Vector2();
    const ray = new THREE.Raycaster();
    ray.params.Points = { threshold: 0.55 };
    let hovered = -1;

    const pick = (cx: number, cy: number) => {
      if (!heads) return -1;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(heads, false)[0];
      return hit?.index ?? -1;
    };
    const showHover = (i: number) => {
      hovered = i;
      host.style.cursor = i >= 0 ? "pointer" : dragging ? "grabbing" : "grab";
      if (i < 0) return setHover(null);
      const b = current[i];
      const v = new THREE.Vector3(b.x, b.h, b.z).applyMatrix4(world.matrixWorld).project(camera);
      setHover({ b, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h });
    };
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (dragging) {
        const dx = e.clientX - dragX;
        dragX = e.clientX;
        moved += Math.abs(dx);
        spinVel = dx * 0.004;
        spin += spinVel;
        return;
      }
      const i = pick(e.clientX, e.clientY);
      if (i !== hovered) showHover(i);
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      dragX = e.clientX;
      moved = 0;
      host.setPointerCapture(e.pointerId);
      host.style.cursor = "grabbing";
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      host.releasePointerCapture?.(e.pointerId);
      if (moved < 5) {
        const i = pick(e.clientX, e.clientY);
        if (i >= 0) pickRef.current(current[i].event);
      }
      host.style.cursor = hovered >= 0 ? "pointer" : "grab";
    };
    const onLeave = () => {
      mouse.tx = mouse.ty = 0;
      showHover(-1);
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointerleave", onLeave);
    host.style.cursor = "grab";

    // Render loop, paused when off screen or the tab is hidden.
    let raf = 0;
    let visible = true;
    let last = performance.now();
    const clock = { t: 0 };
    // Adaptive quality: if frames run slow for two seconds, render fewer
    // pixels (down to 1x) so the hero stays smooth on weaker GPUs.
    let slowSum = 0;
    let slowN = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const raw = (now - last) / 1000;
      const dt = Math.min(0.05, raw);
      last = now;
      if (raw < 0.25) {
        slowSum += raw;
        slowN += 1;
        if (slowN >= 120) {
          if (slowSum / slowN > 1 / 48 && pixel > 1) {
            pixel = Math.max(1, pixel - 0.5);
            renderer.setPixelRatio(pixel);
            renderer.setSize(w, h, false);
            for (const m of [lightsMat, headMat]) m.uniforms.uPixel.value = pixel;
          }
          slowSum = 0;
          slowN = 0;
        }
      }
      clock.t += dt;
      intro = Math.min(1, intro + dt * 0.9);
      const ease = 1 - Math.pow(1 - intro, 3);

      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      if (!dragging) {
        spinVel *= 0.94;
        spin += spinVel + dt * 0.035;
      }
      // City fly-in: pull up to a map of India, glide along the arc to the
      // new city, and drop back down as its lights come on.
      let up = 0;
      let mapVis = 0;
      if (flight) {
        flight.t = Math.min(1, flight.t + dt / FLY_S);
        const t = flight.t;
        up = Math.pow(Math.sin(Math.PI * t), 0.8);
        const s = smooth(0.22, 0.78, t);
        india.position.set(-(flight.from[0] + (flight.to[0] - flight.from[0]) * s), 0, -(flight.from[1] + (flight.to[1] - flight.from[1]) * s));
        mapVis = smooth(0.02, 0.24, t) * (1 - smooth(0.74, 0.98, t));
        arcGeo.setDrawRange(0, Math.round((ARC_N + 1) * smooth(0.18, 0.72, t)));
        if (t >= 1) {
          flight = null;
          india.visible = false;
        }
      }
      const cityVis = Math.pow(1 - up, 2);
      const skyK = SKY_LIGHTS[skyRef.current];
      world.rotation.y = spin + mouse.x * 0.18;
      world.scale.setScalar(0.85 + 0.15 * ease);
      camera.position.set(0, 10.5 - mouse.y * 2 + 78 * up, 17.5 + 26 * up);
      camera.lookAt(world.position.x * 0.12, 0.6, 0);
      (scene.fog as THREE.FogExp2).density = 0.03 * (1 - up) + 0.003 * up;

      for (const m of [lightsMat, headMat]) {
        m.uniforms.uTime.value = clock.t;
        m.uniforms.uOpacity.value = ease * cityVis * (m === lightsMat ? skyK : 1);
      }
      indiaMat.uniforms.uOpacity.value = mapVis;
      pinMat.uniforms.uTime.value = clock.t;
      pinMat.uniforms.uOpacity.value = mapVis;
      arcMat.opacity = mapVis;
      for (const m of [indiaMat, pinMat]) m.uniforms.uPixel.value = pixel;
      beamMat.opacity = 0.85 * ease * cityVis;
      glowMat.uniforms.uOpacity.value = ease * cityVis * skyK;
      if (hovered >= 0 && !dragging) showHover(hovered);
      renderer.render(scene, camera);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(host);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointerleave", onLeave);
      for (const o of [lights, heads, beams]) o?.geometry.dispose();
      lightsMat.dispose();
      glowMat.dispose();
      ground.geometry.dispose();
      headMat.dispose();
      india.traverse((o) => (o as THREE.Points).geometry?.dispose());
      indiaMat.dispose();
      pinMat.dispose();
      arcMat.dispose();
      beamMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  // Changing city flies across India to the new one.
  const lastCenter = useRef(center);
  useEffect(() => {
    const prev = lastCenter.current;
    lastCenter.current = center;
    if (Math.hypot(prev.lat - center.lat, prev.lng - center.lng) < 0.3) return;
    api.current?.fly(prev, center);
    const el = flyLabel.current;
    if (el) {
      el.textContent = `Flying to ${cityName}`;
      el.classList.remove("is-on");
      void el.offsetWidth;
      el.classList.add("is-on");
    }
  }, [center, cityName]);

  // Feed data in whenever the city or its events change.
  useEffect(() => {
    api.current?.setData(makeBeacons(events, center, Date.now()), seedOf(cityName));
  }, [events, center, cityName]);

  return (
    <div className="city3d" ref={wrap} data-cursor={hover ? "Open" : "Drag"}>
      {hover && (
        <div
          className="city3d-tip"
          style={{ left: hover.x, top: hover.y, "--cat": getCategoryColor(hover.b.event.category).color } as React.CSSProperties}
          aria-hidden="true"
        >
          <strong>{hover.b.event.title}</strong>
          <span>
            {formatWhen(hover.b.event.start_time)} · {priceBadge(hover.b.event)}
          </span>
        </div>
      )}
      <p className="city3d-fly" ref={flyLabel} aria-hidden="true" />
      <p className="city3d-hint" aria-hidden="true">
        Each light is a real event · hover to peek · drag to spin
      </p>
    </div>
  );
}
