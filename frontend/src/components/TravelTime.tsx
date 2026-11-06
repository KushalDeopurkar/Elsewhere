"use client";

import { useEffect, useState } from "react";
import {
  Car,
  Bicycle,
  Moped,
  Train,
  Clock,
  PersonSimpleWalk,
  Crosshair,
  Plus,
  X,
  ArrowSquareOut,
  WarningCircle,
  House,
  Briefcase,
  MapPin,
} from "@phosphor-icons/react/ssr";
import type { Event } from "@/lib/types";
import { usePlaces, useOriginId, setOriginId, addPlace, removePlace } from "@/lib/places";
import { travelTimes, geocode, formatDuration, directionsUrl, GeoHit, LatLng, Mode, TravelResult } from "@/lib/travel";
import { isCityCentroid } from "@/lib/cities";
import { useCity } from "@/lib/cityPref";

// "bike" is a bicycle on the free router and a two-wheeler on TomTom.
const modeInfo = (mode: Mode, source: TravelResult["source"]) =>
  mode === "car"
    ? { label: "Drive", Icon: Car }
    : mode === "bike"
      ? source === "osm"
        ? { label: "Cycle", Icon: Bicycle }
        : { label: "2-wheeler", Icon: Moped }
      : mode === "transit"
        ? { label: "Transit", Icon: Train }
        : { label: "Walk", Icon: PersonSimpleWalk };

const clock = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
const istDay = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(ms);
/** "5:02 pm" today, "Sat 8 Nov, 5:02 pm" on another day. */
function when(iso: string, ref: number): string {
  const ms = Date.parse(iso);
  const t = clock.format(ms).toLowerCase();
  return istDay(ms) === istDay(ref) ? t : `${dayFmt.format(ms)}, ${t}`;
}
const LABELS = ["Home", "Work", "Other"] as const;
const labelIcon = (label: string) => (label === "Home" ? House : label === "Work" ? Briefcase : MapPin);

export interface RouteLine {
  origin: LatLng;
  line: [number, number][];
}

/** "How long to get there": travel time from a saved address or the current location. */
export default function TravelTime({ event, onRoute }: { event: Event; onRoute?: (r: RouteLine | null) => void }) {
  const places = usePlaces();
  const originId = useOriginId();
  const city = useCity();

  const [here, setHere] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState<(typeof LABELS)[number]>("Home");
  const [hits, setHits] = useState<{ q: string; list: GeoHit[]; error?: string } | null>(null);

  const [mountedAt] = useState(() => Date.now());
  const [result, setResult] = useState<{ key: string; data?: TravelResult; error?: string } | null>(null);

  const dest = event.lat != null && event.lng != null ? { lat: event.lat, lng: event.lng } : null;
  const place = places.find((p) => p.id === originId) ?? null;
  const origin: LatLng | null = originId === "here" ? here : place ? { lat: place.lat, lng: place.lng } : null;
  const key = origin && dest ? [origin.lat, origin.lng, dest.lat, dest.lng].join(",") : null;
  const approx = dest ? isCityCentroid(dest.lat, dest.lng) : false;

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("This browser can't share its location. Add an address instead.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOriginId("here");
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Add an address instead."
            : "Couldn't get your location. Add an address instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  // A stored "current location" choice needs a fresh fix after a reload.
  useEffect(() => {
    if (originId !== "here" || here || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError("Couldn't get your location. Pick a saved address or add one."),
      { timeout: 10000, maximumAge: 300000 },
    );
  }, [originId, here]);

  // Route whenever the start point or the venue changes.
  useEffect(() => {
    if (!key || !origin || !dest) return;
    let live = true;
    travelTimes(origin, dest, event.start_time).then(
      (data) => {
        if (!live) return;
        setResult({ key, data });
        onRoute?.({ origin, line: data.line });
      },
      (e: Error) => live && setResult({ key, error: e.message || "Routing failed" }),
    );
    return () => {
      live = false;
    };
    // origin/dest are rebuilt each render; key captures their values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Address suggestions, debounced.
  useEffect(() => {
    const q = query.trim();
    if (!adding || q.length < 3) return;
    const t = setTimeout(() => {
      geocode(q, city).then(
        (list) => setHits({ q, list }),
        (e: Error) => setHits({ q, list: [], error: e.message }),
      );
    }, 350);
    return () => clearTimeout(t);
  }, [query, adding, city]);

  const choose = (h: GeoHit) => {
    addPlace({ label, address: h.label, lat: h.lat, lng: h.lng });
    setAdding(false);
    setQuery("");
    setHits(null);
  };

  const loading = !!key && result?.key !== key;
  const current = result?.key === key ? result : null;

  return (
    <section className="travel" aria-label="Travel time">
      <p className="travel-title">How long to get there</p>

      <div className="travel-origins" role="group" aria-label="Start from">
        <button type="button" className="fchip" aria-pressed={originId === "here"} onClick={locate} disabled={locating}>
          <Crosshair size={14} weight="bold" /> {locating ? "Locating…" : "My location"}
        </button>
        {places.map((p) => {
          const Icon = labelIcon(p.label);
          return (
            <span key={p.id} className="travel-place">
              <button type="button" className="fchip" aria-pressed={originId === p.id} onClick={() => setOriginId(p.id)} title={p.address}>
                <Icon size={14} weight="bold" /> {p.label === "Other" ? p.address.split(",")[0] : p.label}
              </button>
              <button
                type="button"
                className="travel-remove"
                aria-label={`Remove ${p.label} address`}
                onClick={() => {
                  if (originId === p.id) onRoute?.(null);
                  removePlace(p.id);
                }}
              >
                <X size={11} weight="bold" />
              </button>
            </span>
          );
        })}
        {!adding && places.length < 5 && (
          <button type="button" className="fchip" onClick={() => setAdding(true)}>
            <Plus size={14} weight="bold" /> Add address
          </button>
        )}
      </div>

      {adding && (
        <div className="travel-add">
          <div className="travel-add-row">
            <select className="binput travel-label" value={label} onChange={(e) => setLabel(e.target.value as (typeof LABELS)[number])} aria-label="Address label">
              {LABELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <input
              className="binput"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Area, street or landmark in ${city.name}`}
              aria-label="Search for an address"
              autoFocus
            />
            <button type="button" className="icon-btn" aria-label="Cancel" onClick={() => { setAdding(false); setQuery(""); setHits(null); }}>
              <X size={15} weight="bold" />
            </button>
          </div>
          {hits && hits.q === query.trim() && (
            hits.error ? (
              <p className="travel-note is-error"><WarningCircle size={14} weight="fill" /> {hits.error}</p>
            ) : hits.list.length === 0 ? (
              <p className="travel-note">No match. Try a nearby landmark or area name.</p>
            ) : (
              <ul className="travel-hits">
                {hits.list.map((h, i) => (
                  <li key={`${h.lat},${h.lng},${i}`}>
                    <button type="button" onClick={() => choose(h)}>{h.label}</button>
                  </li>
                ))}
              </ul>
            )
          )}
          <p className="travel-note">Saved on this device only.</p>
        </div>
      )}

      {geoError && <p className="travel-note is-error"><WarningCircle size={14} weight="fill" /> {geoError}</p>}

      {!dest ? (
        <p className="travel-note">This listing has no venue location, so travel time can&apos;t be worked out.</p>
      ) : !origin ? (
        !adding && <p className="travel-note">Pick where you&apos;re starting from to see drive, bike and walk times.</p>
      ) : loading ? (
        <ul className="travel-legs is-loading" aria-busy="true">
          {(["car", "bike", "foot"] as Mode[]).map((m) => <li key={m}><span className="travel-skel" /></li>)}
        </ul>
      ) : current?.error ? (
        <p className="travel-note is-error"><WarningCircle size={14} weight="fill" /> {current.error}. Try again in a moment.</p>
      ) : current?.data ? (
        <>
          <ul className="travel-legs">
            {current.data.legs.map((l) => {
              const { label: name, Icon } = modeInfo(l.mode, current.data!.source);
              return (
                <li key={l.mode}>
                  <Icon size={18} weight="duotone" />
                  <span className="travel-time">{formatDuration(l.minutes)}</span>
                  <span className="travel-mode">{name} · {l.km} km</span>
                  {l.delayMinutes ? <span className="travel-delay">+{l.delayMinutes} min traffic</span> : null}
                </li>
              );
            })}
          </ul>
          {current.data.leaveBy && (
            <p className="travel-leave">
              <Clock size={15} weight="bold" />
              <span>
                Leave by <strong>{when(current.data.leaveBy.departAt, mountedAt)}</strong> to arrive for the{" "}
                {when(event.start_time, mountedAt)} start ({formatDuration(current.data.leaveBy.minutes)} drive in usual traffic then).
              </span>
            </p>
          )}
          <p className="travel-note">
            {current.data.source === "google"
              ? "Live traffic right now, from Google Maps"
              : current.data.source === "tomtom"
                ? "Live traffic right now, from TomTom"
                : "Road estimate without live traffic"}
            {approx ? ". The venue pin is the city centre, as the listing has no exact address" : ""}.{" "}
            <a href={directionsUrl(origin, dest)} target="_blank" rel="noopener noreferrer" className="travel-link">
              {current.data.source === "osm" ? "Live traffic in Google Maps" : "Directions in Google Maps"} <ArrowSquareOut size={12} weight="bold" />
            </a>
          </p>
        </>
      ) : null}
    </section>
  );
}
