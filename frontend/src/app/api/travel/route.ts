import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Traffic-aware travel time, server-side so API keys stay private.
 *
 * Provider order: Google Routes API (GOOGLE_MAPS_API_KEY), then TomTom
 * (TOMTOM_API_KEY). Car and two-wheeler use live traffic for "leave now";
 * "leave by" uses the provider's traffic prediction for the event start.
 *
 * GET /api/travel?from=lat,lng&to=lat,lng&arrive=<ISO event start>
 * 501 when neither key is set, so the client falls back to the free
 * no-traffic estimate.
 */

const API = (process.env.TOMTOM_API_BASE || "https://api.tomtom.com").replace(/\/$/, "");
type Mode = "car" | "bike" | "foot" | "transit";
const TRAVEL_MODE: Record<Exclude<Mode, "transit">, string> = { car: "car", bike: "motorcycle", foot: "pedestrian" };

interface Leg {
  mode: Mode;
  minutes: number;
  km: number;
  delayMinutes: number;
}

interface TravelBody {
  source: "google" | "tomtom";
  legs: Leg[];
  line: [number, number][];
  leaveBy: { departAt: string; minutes: number } | null;
  computedAt: string;
}

type LL = { lat: number; lng: number };

// ---- Google Routes API --------------------------------------------------
const GOOGLE = (process.env.GOOGLE_ROUTES_API_BASE || "https://routes.googleapis.com").replace(/\/$/, "");
const G_MODE: Record<Mode, string> = { car: "DRIVE", bike: "TWO_WHEELER", foot: "WALK", transit: "TRANSIT" };
const secs = (d?: string) => (d ? Number(d.replace(/s$/, "")) : NaN);

async function googleRoute(key: string, a: LL, b: LL, mode: Mode, opts: { departAt?: string; line?: boolean } = {}) {
  const body: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: a.lat, longitude: a.lng } } },
    destination: { location: { latLng: { latitude: b.lat, longitude: b.lng } } },
    travelMode: G_MODE[mode],
    languageCode: "en-IN",
    regionCode: "IN",
    units: "METRIC",
  };
  // Traffic only applies to road vehicles; Google rejects it for the rest.
  if (mode === "car" || mode === "bike") body.routingPreference = "TRAFFIC_AWARE";
  if (opts.departAt) body.departureTime = opts.departAt;
  if (opts.line) body.polylineEncoding = "GEO_JSON_LINESTRING";
  const res = await fetch(`${GOOGLE}/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": `routes.duration,routes.staticDuration,routes.distanceMeters${opts.line ? ",routes.polyline" : ""}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google ${mode} ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
  }
  const r = (await res.json())?.routes?.[0];
  const duration = secs(r?.duration);
  if (!r || !Number.isFinite(duration)) throw new Error(`Google ${mode}: no route`);
  const free = secs(r.staticDuration);
  return {
    seconds: duration,
    leg: {
      mode,
      minutes: Math.max(1, Math.round(duration / 60)),
      km: Math.round((r.distanceMeters ?? 0) / 100) / 10,
      delayMinutes: mode === "car" || mode === "bike" ? Math.max(0, Math.round((duration - (Number.isFinite(free) ? free : duration)) / 60)) : 0,
    } as Leg,
    line: (opts.line ? r.polyline?.geoJsonLinestring?.coordinates ?? [] : []) as [number, number][],
  };
}

async function viaGoogle(key: string, a: LL, b: LL, arriveMs: number | null, now: number): Promise<TravelBody | null> {
  const jobs = await Promise.allSettled([
    googleRoute(key, a, b, "car", { line: true }),
    googleRoute(key, a, b, "bike"),
    googleRoute(key, a, b, "transit"),
    googleRoute(key, a, b, "foot"),
  ]);
  const ok = jobs.flatMap((j) => (j.status === "fulfilled" ? [j.value] : []));
  if (!ok.length) {
    const why = jobs.find((j) => j.status === "rejected") as PromiseRejectedResult | undefined;
    console.error("[travel] google", (why?.reason as Error)?.message?.replaceAll(key, "***"));
    return null;
  }
  const car = jobs[0].status === "fulfilled" ? jobs[0].value : null;

  // Leave-by: Google only predicts traffic for a departure time, so start
  // from the live drive time, then re-ask for that departure and use it.
  let leaveBy: TravelBody["leaveBy"] = null;
  if (car && arriveMs) {
    const guess = arriveMs - car.seconds * 1000;
    if (guess > now + 60_000) {
      try {
        const then = await googleRoute(key, a, b, "car", { departAt: new Date(guess).toISOString() });
        const depart = arriveMs - then.seconds * 1000;
        if (depart > now) leaveBy = { departAt: new Date(depart).toISOString(), minutes: then.leg.minutes };
      } catch (e) {
        console.warn("[travel] google leave-by", (e as Error).message.replaceAll(key, "***"));
      }
    }
  }
  return { source: "google", legs: ok.map((o) => o.leg), line: car?.line ?? [], leaveBy, computedAt: new Date(now).toISOString() };
}

// ---- TomTom -------------------------------------------------------------

interface Summary {
  lengthInMeters: number;
  travelTimeInSeconds: number;
  trafficDelayInSeconds?: number;
  noTrafficTravelTimeInSeconds?: number;
  departureTime?: string;
  arrivalTime?: string;
}

function point(raw: string | null): { lat: number; lng: number } | null {
  const m = raw?.match(/^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  // India and its neighbourhood only: keeps the free quota for this app's use.
  if (lat < 5 || lat > 38 || lng < 67 || lng > 98) return null;
  return { lat, lng };
}

const cache = new Map<string, { at: number; body: unknown }>();

async function route(key: string, from: string, to: string, mode: Exclude<Mode, "transit">, when: { departAt?: string; arriveAt?: string }, points: boolean) {
  const qs = new URLSearchParams({
    key,
    travelMode: TRAVEL_MODE[mode],
    traffic: mode === "foot" ? "false" : "true",
    routeType: "fastest",
    computeTravelTimeFor: "all",
    routeRepresentation: points ? "polyline" : "summaryOnly",
  });
  if (when.arriveAt) qs.set("arriveAt", when.arriveAt);
  else qs.set("departAt", when.departAt ?? "now");
  const res = await fetch(`${API}/routing/1/calculateRoute/${from}:${to}/json?${qs}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TomTom ${mode} ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}`);
  }
  const json = await res.json();
  const r = json?.routes?.[0];
  if (!r) throw new Error(`TomTom ${mode}: no route`);
  const line: [number, number][] = points
    ? (r.legs ?? []).flatMap((l: { points?: { latitude: number; longitude: number }[] }) =>
        (l.points ?? []).map((p) => [p.longitude, p.latitude] as [number, number]),
      )
    : [];
  return { summary: r.summary as Summary, line };
}

async function viaTomTom(key: string, from: string, to: string, arriveAt: string | null, now: number): Promise<TravelBody | null> {
  const jobs = await Promise.allSettled([
    route(key, from, to, "car", {}, true),
    route(key, from, to, "bike", {}, false),
    route(key, from, to, "foot", {}, false),
    arriveAt ? route(key, from, to, "car", { arriveAt }, false) : Promise.resolve(null),
  ]);
  const [car, bike, foot, arrive] = jobs;
  const legs = (
    [
      ["car", car],
      ["bike", bike],
      ["foot", foot],
    ] as const
  ).flatMap(([mode, j]) => {
    if (j.status !== "fulfilled" || !j.value) return [];
    const s = j.value.summary;
    return [
      {
        mode,
        minutes: Math.max(1, Math.round(s.travelTimeInSeconds / 60)),
        km: Math.round(s.lengthInMeters / 100) / 10,
        delayMinutes: mode === "foot" ? 0 : Math.round((s.trafficDelayInSeconds ?? 0) / 60),
      } as Leg,
    ];
  });
  if (!legs.length) {
    const reason = jobs.find((j) => j.status === "rejected") as PromiseRejectedResult | undefined;
    console.error("[travel] tomtom", (reason?.reason as Error)?.message?.replaceAll(key, "***"));
    return null;
  }
  const leaveBy =
    arrive.status === "fulfilled" && arrive.value?.summary.departureTime
      ? { departAt: arrive.value.summary.departureTime, minutes: Math.round(arrive.value.summary.travelTimeInSeconds / 60) }
      : null;
  return {
    source: "tomtom",
    legs,
    line: car.status === "fulfilled" ? car.value.line : [],
    leaveBy,
    computedAt: new Date(now).toISOString(),
  };
}

export async function GET(req: Request) {
  const google = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const tomtom = process.env.TOMTOM_API_KEY?.trim();
  if (!google && !tomtom) return NextResponse.json({ error: "Traffic-aware times are not set up." }, { status: 501 });

  const sp = new URL(req.url).searchParams;
  const a = point(sp.get("from"));
  const b = point(sp.get("to"));
  if (!a || !b) return NextResponse.json({ error: "Send from=lat,lng and to=lat,lng inside India." }, { status: 400 });
  const from = `${a.lat.toFixed(5)},${a.lng.toFixed(5)}`;
  const to = `${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;

  // Arrive-by only for an event that starts at least 10 minutes from now
  // and within the providers' planning window.
  const parsed = Date.parse(sp.get("arrive") ?? "");
  const now = Date.now();
  const arriveMs = Number.isFinite(parsed) && parsed > now + 10 * 60_000 && parsed < now + 30 * 86_400_000 ? parsed : null;
  const arriveAt = arriveMs ? new Date(arriveMs).toISOString().replace(/\.\d{3}Z$/, "Z") : null;

  // Live traffic changes minute to minute; a 2-minute cache is plenty.
  const cacheKey = `${from}:${to}:${arriveAt ?? ""}`;
  const hit = cache.get(cacheKey);
  if (hit && now - hit.at < 120_000) return NextResponse.json(hit.body);

  const body =
    (google ? await viaGoogle(google, a, b, arriveMs, now) : null) ??
    (tomtom ? await viaTomTom(tomtom, from, to, arriveAt, now) : null);
  if (!body) return NextResponse.json({ error: "The traffic service didn't answer. Try again in a moment." }, { status: 502 });

  cache.set(cacheKey, { at: now, body });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=60" } });
}
