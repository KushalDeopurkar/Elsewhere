import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Traffic-aware travel time from TomTom Routing (server-side so the key
 * stays private). Car and two-wheeler times use live traffic for "leave
 * now"; "leave by" uses TomTom's traffic model for the event start time.
 *
 * GET /api/travel?from=lat,lng&to=lat,lng&arrive=<ISO event start>
 * 501 when TOMTOM_API_KEY is not set, so the client falls back to the
 * free no-traffic estimate.
 */

const API = (process.env.TOMTOM_API_BASE || "https://api.tomtom.com").replace(/\/$/, "");
type Mode = "car" | "bike" | "foot";
const TRAVEL_MODE: Record<Mode, string> = { car: "car", bike: "motorcycle", foot: "pedestrian" };

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

async function route(key: string, from: string, to: string, mode: Mode, when: { departAt?: string; arriveAt?: string }, points: boolean) {
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

export async function GET(req: Request) {
  const key = process.env.TOMTOM_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Traffic-aware times are not set up." }, { status: 501 });

  const sp = new URL(req.url).searchParams;
  const a = point(sp.get("from"));
  const b = point(sp.get("to"));
  if (!a || !b) return NextResponse.json({ error: "Send from=lat,lng and to=lat,lng inside India." }, { status: 400 });
  const from = `${a.lat.toFixed(5)},${a.lng.toFixed(5)}`;
  const to = `${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;

  // Arrive-by only for an event that starts at least 10 minutes from now
  // and within TomTom's planning window.
  const arriveMs = Date.parse(sp.get("arrive") ?? "");
  const now = Date.now();
  const arriveAt =
    Number.isFinite(arriveMs) && arriveMs > now + 10 * 60_000 && arriveMs < now + 30 * 86_400_000
      ? new Date(arriveMs).toISOString().replace(/\.\d{3}Z$/, "Z")
      : null;

  // Live traffic changes minute to minute; a 2-minute cache is plenty.
  const cacheKey = `${from}:${to}:${arriveAt ?? ""}`;
  const hit = cache.get(cacheKey);
  if (hit && now - hit.at < 120_000) return NextResponse.json(hit.body);

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
        noTrafficMinutes: s.noTrafficTravelTimeInSeconds ? Math.round(s.noTrafficTravelTimeInSeconds / 60) : null,
      },
    ];
  });

  if (!legs.length) {
    const reason = jobs.find((j) => j.status === "rejected") as PromiseRejectedResult | undefined;
    console.error("[travel]", (reason?.reason as Error)?.message?.replace(key, "***"));
    return NextResponse.json({ error: "The traffic service didn't answer. Try again in a moment." }, { status: 502 });
  }

  const leaveBy =
    arrive.status === "fulfilled" && arrive.value?.summary.departureTime
      ? { departAt: arrive.value.summary.departureTime, minutes: Math.round(arrive.value.summary.travelTimeInSeconds / 60) }
      : null;

  const body = {
    source: "tomtom" as const,
    legs,
    line: car.status === "fulfilled" ? car.value.line : [],
    leaveBy,
    computedAt: new Date(now).toISOString(),
  };
  cache.set(cacheKey, { at: now, body });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=60" } });
}
