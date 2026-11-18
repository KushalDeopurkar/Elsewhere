"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setGrade } from "@/lib/grade";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowsClockwise, Brain, Champagne, DiceFive, Fire, Heart, Leaf, Lightning, MapPin, Palette, X, type Icon } from "@phosphor-icons/react";
import EventCard from "./EventCard";
import EventImage from "./EventImage";
import { useCity } from "@/lib/cityPref";
import { useCityEvents } from "@/hooks/useCityEvents";
import { COLD_START, recordSignal, scoreEvent, useTaste } from "@/lib/taste";
import { ensureSaved } from "@/lib/saved";
import { formatWhen } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import {
  BUDGET_MAX,
  DISTANCE_MAX,
  VIBES,
  applyVibe,
  filtersFromParams,
  filtersToQuery,
  type VibeFilters,
  type VibeHit,
  type VibeId,
  type When,
} from "@/lib/vibe";

const BUDGETS = [0, 250, 500, 1000, 1500, 2000, 3000, BUDGET_MAX];
const DISTANCES = [2, 5, 10, 20, DISTANCE_MAX];
const WHENS: { id: When; label: string }[] = [
  { id: "any", label: "Any time" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "This weekend" },
  { id: "week", label: "Next 7 days" },
];
const PAGE = 24;
const VIBE_ICON: Record<VibeId, Icon> = {
  chill: Leaf,
  social: Champagne,
  learn: Brain,
  wild: Fire,
  creative: Palette,
  active: Lightning,
};

const nearestIndex = (steps: number[], v: number) =>
  steps.reduce((best, s, i) => (Math.abs(s - v) < Math.abs(steps[best] - v) ? i : best), 0);
const budgetLabel = (b: number) =>
  b === 0 ? "Free only" : b >= BUDGET_MAX ? "Any price" : `Up to ₹${b.toLocaleString("en-IN")}`;
const distanceLabel = (d: number) => (d >= DISTANCE_MAX ? "Anywhere in the city" : `Within ${d} km`);

export default function VibeView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const city = useCity();
  const pool = useCityEvents(city, { limit: 100 });
  const taste = useTaste();
  const reduce = useReducedMotion() ?? false;

  const [f, setF] = useState<VibeFilters>(() => filtersFromParams(new URLSearchParams(params.toString())));
  const [shown, setShown] = useState(PAGE);
  const [surprise, setSurprise] = useState(false);

  // Keep the link in step with the controls so a vibe can be shared.
  useEffect(() => {
    const next = `${pathname}${filtersToQuery(f)}`;
    if (next !== `${pathname}${params.toString() ? `?${params}` : ""}`) router.replace(next, { scroll: false });
  }, [f, pathname, params, router]);

  const set = (patch: Partial<VibeFilters>) => {
    setF((x) => ({ ...x, ...patch }));
    setShown(PAGE);
  };
  // The first picked mood grades the whole site for this session.
  const lead = f.vibes[0] ?? null;
  useEffect(() => {
    setGrade(lead);
  }, [lead]);
  const toggleVibe = (id: VibeId) =>
    set({ vibes: f.vibes.includes(id) ? f.vibes.filter((v) => v !== id) : [...f.vibes, id] });

  const warm = taste.signals >= COLD_START;
  const hits = useMemo(
    () =>
      applyVibe(pool.events, f, { lat: city.lat, lng: city.lng }, {
        taste: warm ? (e) => scoreEvent(e, taste).score : undefined,
      }),
    [pool.events, f, city.lat, city.lng, warm, taste],
  );

  return (
    <main className="vibe">
      <section className="shell vibe-head">
        <p className="vibe-kicker">Vibe check · {city.name}</p>
        <h1 className="vibe-title">
          What&apos;s the <em>vibe</em> today?
        </h1>
        <p className="vibe-lede">Pick one or mix a few. Everything below rearranges as you go.</p>

        <div className="vibe-moods" role="group" aria-label="Moods">
          {VIBES.map((v) => {
            const on = f.vibes.includes(v.id);
            const VIcon = VIBE_ICON[v.id];
            return (
              <motion.button
                key={v.id}
                type="button"
                className={`vibe-mood is-${v.id}${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => toggleVibe(v.id)}
                whileTap={reduce ? undefined : { scale: 0.94 }}
                whileHover={reduce ? undefined : { y: -3 }}
              >
                <motion.span
                  className="vibe-emoji"
                  aria-hidden="true"
                  animate={on && !reduce ? { scale: [1, 1.35, 1], rotate: [0, -10, 0] } : { scale: 1 }}
                  transition={{ duration: 0.45 }}
                >
                  <VIcon size={28} weight={on ? "fill" : "duotone"} />
                </motion.span>
                <span className="vibe-mood-name">{v.label}</span>
                <span className="vibe-mood-line">{v.line}</span>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="vibe-controls-wrap">
        <div className="shell vibe-controls">
          <label className="vibe-slider">
            <span className="vibe-ctl-label">
              Budget <strong>{budgetLabel(f.budget)}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={BUDGETS.length - 1}
              step={1}
              value={nearestIndex(BUDGETS, f.budget)}
              style={{ "--pct": `${(nearestIndex(BUDGETS, f.budget) / (BUDGETS.length - 1)) * 100}%` } as React.CSSProperties}
              onChange={(e) => set({ budget: BUDGETS[Number(e.target.value)] })}
              aria-valuetext={budgetLabel(f.budget)}
            />
          </label>
          <label className="vibe-slider">
            <span className="vibe-ctl-label">
              Distance <strong>{distanceLabel(f.distance)}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={DISTANCES.length - 1}
              step={1}
              value={nearestIndex(DISTANCES, f.distance)}
              style={{ "--pct": `${(nearestIndex(DISTANCES, f.distance) / (DISTANCES.length - 1)) * 100}%` } as React.CSSProperties}
              onChange={(e) => set({ distance: DISTANCES[Number(e.target.value)] })}
              aria-valuetext={distanceLabel(f.distance)}
            />
          </label>
          <div className="vibe-when" role="group" aria-label="When">
            {WHENS.map((w) => (
              <button
                key={w.id}
                type="button"
                className="chip"
                aria-pressed={f.when === w.id}
                onClick={() => set({ when: w.id })}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="shell vibe-results">
        <div className="vibe-results-head">
          <p className="vibe-count" aria-live="polite">
            <motion.strong key={hits.length} initial={reduce ? false : { y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              {pool.loading ? "…" : hits.length}
            </motion.strong>{" "}
            {hits.length === 1 ? "event matches" : "events match"}
            {warm && hits.length > 1 && <span className="vibe-sub"> · sorted for your taste</span>}
          </p>
          <div className="vibe-row">
            {(f.vibes.length > 0 || f.when !== "any" || f.budget < BUDGET_MAX || f.distance < DISTANCE_MAX) && (
              <button className="btn btn-ghost" type="button" onClick={() => set({ vibes: [], budget: BUDGET_MAX, distance: DISTANCE_MAX, when: "any" })}>
                Clear
              </button>
            )}
            <button className="btn btn-primary" type="button" onClick={() => setSurprise(true)} disabled={!hits.length}>
              <DiceFive size={18} weight="fill" aria-hidden="true" /> Surprise me
            </button>
          </div>
        </div>

        {pool.isSample && <p className="notice">Live data is unreachable right now, so these are sample events.</p>}

        {pool.loading ? (
          <div className="vibe-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="vibe-skel" />
            ))}
          </div>
        ) : hits.length === 0 ? (
          <div className="vibe-empty">
            <MapPin className="vibe-empty-emoji" size={40} weight="duotone" aria-hidden="true" />
            <p>Nothing fits all of that. Try a bigger budget, more distance, or another day.</p>
          </div>
        ) : (
          <>
            <motion.div className="vibe-grid">
              <AnimatePresence mode="popLayout" initial={false}>
                {hits.slice(0, shown).map((h, i) => (
                  <motion.div
                    key={h.event.id}
                    layout={reduce ? false : "position"}
                    initial={reduce ? false : { opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    onClickCapture={() => recordSignal(h.event, "open")}
                    className="vibe-cell"
                  >
                    <EventCard event={h.event} priority={i < 3} badge={h.km != null && h.km < 3 ? "Very close" : undefined} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
            {shown < hits.length && (
              <div className="vibe-more">
                <button className="btn btn-ghost" type="button" onClick={() => setShown((s) => s + PAGE)}>
                  Show {Math.min(PAGE, hits.length - shown)} more
                </button>
              </div>
            )}
          </>
        )}

        <p className="vibe-swipe-cta">
          Can&apos;t decide? <Link href="/discover">Swipe through them one at a time →</Link>
        </p>
      </section>

      <AnimatePresence>
        {surprise && hits.length > 0 && <Surprise hits={hits} reduce={reduce} onClose={() => setSurprise(false)} />}
      </AnimatePresence>
    </main>
  );
}

/** Weighted pick from the top of the list: better matches come up more. */
function pick(hits: VibeHit[], not?: string): VibeHit {
  const pool = hits.slice(0, 15).filter((h) => h.event.id !== not);
  const list = pool.length ? pool : hits;
  const weights = list.map((_, i) => 1 / (i + 2));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) if ((r -= weights[i]) <= 0) return list[i];
  return list[0];
}

function Surprise({ hits, reduce, onClose }: { hits: VibeHit[]; reduce: boolean; onClose: () => void }) {
  const [landed, setLanded] = useState<VibeHit | null>(null);
  const [reel, setReel] = useState(hits[0].event.title);
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const spin = useCallback(
    (not?: string) => {
      const target = pick(hits, not);
      setLanded(null);
      setSaved(false);
      if (reduce) {
        setLanded(target);
        return;
      }
      // Slot-machine reel: fast at first, slowing down, then land.
      let step = 0;
      const delays = [50, 50, 50, 55, 60, 70, 80, 95, 115, 140, 170, 210, 260];
      const tick = () => {
        if (step >= delays.length) {
          setLanded(target);
          return;
        }
        setReel(hits[Math.floor(Math.random() * Math.min(hits.length, 30))].event.title);
        timer.current = window.setTimeout(tick, delays[step++]);
      };
      tick();
    },
    [hits, reduce],
  );

  // Latest callbacks in refs, so a parent re-render (the URL sync, a count
  // update) never restarts the spin or drops the Escape handler.
  const spinRef = useRef(spin);
  const closeCb = useRef(onClose);
  useEffect(() => {
    spinRef.current = spin;
    closeCb.current = onClose;
  });
  useEffect(() => {
    const t = window.setTimeout(() => spinRef.current(), 0);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCb.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      if (timer.current) window.clearTimeout(timer.current);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const e = landed?.event;
  return (
    <motion.div className="vibe-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="vibe-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Surprise pick"
        initial={reduce ? false : { y: 30, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        exit={reduce ? undefined : { y: 20, opacity: 0 }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <button ref={closeRef} className="vibe-close" type="button" onClick={onClose} aria-label="Close">
          <X size={18} weight="bold" />
        </button>
        {!e ? (
          <div className="vibe-reel" aria-live="off">
            <p className="vibe-kicker">Rolling the dice…</p>
            <p className="vibe-reel-text">{reel}</p>
          </div>
        ) : (
          <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} aria-live="polite">
            <EventImage src={e.image_url} alt="" category={e.category} ratio="16 / 9" priority className="vibe-dialog-img" />
            <p className="vibe-kicker">Your surprise pick</p>
            <h2 className="vibe-dialog-title">{e.title}</h2>
            <p className="vibe-dialog-meta">
              {formatWhen(e.start_time)} · {priceBadge(e)}
              {e.location_name && (
                <>
                  {" "}
                  · <MapPin size={13} weight="bold" aria-hidden="true" /> {e.location_name}
                </>
              )}
            </p>
            <div className="vibe-row">
              <Link className="btn btn-primary" href={`/events/${e.id}`} onClick={() => recordSignal(e, "open")}>
                Let&apos;s go
              </Link>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={saved}
                onClick={() => {
                  ensureSaved(e);
                  recordSignal(e, "save");
                  setSaved(true);
                }}
              >
                <Heart size={16} weight="fill" aria-hidden="true" /> {saved ? "Saved" : "Save"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => spin(e.id)}>
                <ArrowsClockwise size={16} weight="bold" aria-hidden="true" /> Spin again
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
