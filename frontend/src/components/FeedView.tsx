"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CaretDown, Clock, Heart, MapPin, ShareFat, Sparkle } from "@phosphor-icons/react";
import EventImage from "./EventImage";
import { useCity } from "@/lib/cityPref";
import { useCityEvents } from "@/hooks/useCityEvents";
import { COLD_START, readTaste, recordSignal, scoreEvent, useTaste } from "@/lib/taste";
import { BATCH, nextBatch } from "@/lib/feedCore";
import { ensureSaved, isSaved, toggleSaved, useSaved } from "@/lib/saved";
import { formatWhen } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import { eventShareText, whatsappUrl } from "@/lib/share";
import { CATEGORIES, type Event } from "@/lib/types";

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
const DWELL_MS = 4000;

interface Burst { key: number; id: string; x: number; y: number }

export default function FeedView() {
  const city = useCity();
  const pool = useCityEvents(city, { limit: 100 });
  const taste = useTaste();
  const saved = useSaved();
  const reduce = useReducedMotion() ?? false;

  const [items, setItems] = useState<Event[]>([]);
  const [dealtFrom, setDealtFrom] = useState<Event[] | null>(null);
  const [active, setActive] = useState(0);
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Event[]>([]);
  const poolRef = useRef<Event[]>([]);
  const dwelled = useRef(new Set<string>());
  const lastTap = useRef<{ id: string; t: number } | null>(null);

  // First batch whenever a new set of events arrives (city change).
  if (!pool.loading && dealtFrom !== pool.events) {
    const first = nextBatch(pool.events, new Set(), readTaste(), { n: BATCH });
    setDealtFrom(pool.events);
    setItems(first);
    setActive(0);
    setDone(first.length >= pool.events.length);
  }

  useEffect(() => {
    itemsRef.current = items;
    poolRef.current = pool.events;
  });

  // Append the next batch, ranked by the taste as it is right now.
  const grow = useCallback(() => {
    const shown = new Set(itemsRef.current.map((e) => e.id));
    const more = nextBatch(poolRef.current, shown, readTaste(), { n: BATCH });
    if (!more.length) {
      setDone(true);
      return;
    }
    setItems((cur) => [...cur, ...more]);
  }, []);

  // Track which slide is on screen.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const i = Number((en.target as HTMLElement).dataset.i);
          setActive(i);
          if (i > 0) setScrolled(true);
          if (i >= itemsRef.current.length - 3) grow();
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll<HTMLElement>(".feed-slide[data-i]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length, grow]);

  // Lingering is the main signal the feed learns from.
  const current = items[active];
  useEffect(() => {
    if (!current || dwelled.current.has(current.id)) return;
    const t = window.setTimeout(() => {
      dwelled.current.add(current.id);
      recordSignal(current, "dwell");
    }, DWELL_MS);
    return () => window.clearTimeout(t);
  }, [current]);

  const go = useCallback(
    (delta: number) => {
      const root = scroller.current;
      if (!root) return;
      const slides = root.querySelectorAll<HTMLElement>(".feed-slide");
      const target = slides[Math.max(0, Math.min(slides.length - 1, active + delta))];
      target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    },
    [active, reduce],
  );

  const like = useCallback((e: Event) => {
    if (isSaved(saved, e.id)) {
      toggleSaved(e);
      recordSignal(e, "save", -1);
    } else {
      ensureSaved(e);
      recordSignal(e, "save");
    }
  }, [saved]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (ev.key === "ArrowDown" || ev.key === "j") {
        ev.preventDefault();
        go(1);
      } else if (ev.key === "ArrowUp" || ev.key === "k") {
        ev.preventDefault();
        go(-1);
      } else if ((ev.key === "l" || ev.key === "s") && current) {
        like(current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, like, current]);

  const onTap = (e: Event, ev: React.PointerEvent<HTMLDivElement>) => {
    const now = ev.timeStamp;
    const prev = lastTap.current;
    lastTap.current = { id: e.id, t: now };
    if (!prev || prev.id !== e.id || now - prev.t > 300) return;
    lastTap.current = null;
    const box = ev.currentTarget.getBoundingClientRect();
    setBurst({ key: now, id: e.id, x: ev.clientX - box.left, y: ev.clientY - box.top });
    if (!isSaved(saved, e.id)) {
      ensureSaved(e);
      recordSignal(e, "save");
    }
  };

  const share = async (e: Event) => {
    const text = eventShareText(e, window.location.origin);
    if (navigator.share) {
      try {
        await navigator.share({ title: e.title, text, url: `${window.location.origin}/events/${e.id}` });
        return;
      } catch {
        /* cancelled: fall through to nothing */
        return;
      }
    }
    window.open(whatsappUrl(text), "_blank", "noopener,noreferrer");
  };

  const warm = taste.signals >= COLD_START;

  if (pool.loading) {
    return (
      <main className="feed">
        <div className="feed-scroller">
          <section className="feed-slide">
            <div className="feed-card is-skeleton" aria-label="Loading events" />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="feed">
      <div className="feed-top">
        <span className="feed-pill">
          <Sparkle size={13} weight="fill" aria-hidden="true" />
          {warm ? "Tuned to you" : "Learning what you like"} · {city.name}
        </span>
        {pool.isSample && <span className="feed-pill is-warn">Sample events</span>}
      </div>

      <div className="feed-scroller" ref={scroller} tabIndex={-1} aria-label="Event feed">
        {items.map((e, i) => {
          const m = warm ? scoreEvent(e, taste) : null;
          const on = isSaved(saved, e.id);
          return (
            <section key={e.id} className="feed-slide" data-i={i} aria-label={`${i + 1}: ${e.title}`}>
              {e.image_url && <img className="feed-backdrop" src={e.image_url} alt="" aria-hidden="true" referrerPolicy="no-referrer" />}
              <div className="feed-frame">
                <div className="feed-card" data-cursor="Double-click" onPointerUp={(ev) => onTap(e, ev)} onDoubleClick={(ev) => ev.preventDefault()}>
                  <EventImage src={e.image_url} alt="" category={e.category} ratio="9 / 16" priority={i < 2} className="feed-img" />
                  <AnimatePresence>
                    {burst?.id === e.id && (
                      <motion.span
                        key={burst.key}
                        className="feed-burst"
                        style={{ left: burst.x, top: burst.y }}
                        initial={{ scale: 0.2, opacity: 0, rotate: -15 }}
                        animate={{ scale: [0.2, 1.3, 1], opacity: [0, 1, 1], rotate: 0 }}
                        exit={{ scale: 1.6, opacity: 0, y: -40 }}
                        transition={{ duration: 0.45 }}
                        onAnimationComplete={() => setBurst((b) => (b?.key === burst.key ? null : b))}
                        aria-hidden="true"
                      >
                        <Heart size={96} weight="fill" />
                      </motion.span>
                    )}
                  </AnimatePresence>

                  <div className="feed-info">
                    {m && (
                      <p className="feed-match">
                        <strong>{m.score}%</strong> match{m.reasons.length ? ` · ${m.reasons.join(" · ")}` : ""}
                      </p>
                    )}
                    <div className="feed-tags">
                      <span className="feed-tag">{CAT_LABEL[e.category] ?? e.category}</span>
                      <span className="feed-tag is-price">{priceBadge(e)}</span>
                    </div>
                    <h2 className="feed-name">{e.title}</h2>
                    <p className="feed-meta">
                      <Clock size={15} weight="bold" aria-hidden="true" /> {formatWhen(e.start_time)}
                    </p>
                    {e.location_name && (
                      <p className="feed-meta">
                        <MapPin size={15} weight="bold" aria-hidden="true" /> {e.location_name}
                      </p>
                    )}
                    {e.description && <p className="feed-desc">{e.description}</p>}
                  </div>
                </div>

                <div className="feed-rail" role="group" aria-label="Actions">
                  <motion.button
                    type="button"
                    className={`feed-act${on ? " is-on" : ""}`}
                    onClick={() => like(e)}
                    aria-pressed={on}
                    aria-label={on ? "Remove from saved" : "Save"}
                    whileTap={reduce ? undefined : { scale: 0.8 }}
                  >
                    <Heart size={28} weight={on ? "fill" : "bold"} />
                    <span>{on ? "Saved" : "Save"}</span>
                  </motion.button>
                  <button type="button" className="feed-act" onClick={() => share(e)} aria-label="Share">
                    <ShareFat size={26} weight="fill" />
                    <span>Share</span>
                  </button>
                  <Link className="feed-act" href={`/events/${e.id}`} onClick={() => recordSignal(e, "open")} aria-label="Details">
                    <ArrowRight size={26} weight="bold" />
                    <span>Details</span>
                  </Link>
                </div>
              </div>

              {i === 0 && !scrolled && (
                <button type="button" className="feed-hint" onClick={() => go(1)}>
                  <CaretDown size={18} weight="bold" aria-hidden="true" /> Scroll for more · double-tap to save
                </button>
              )}
            </section>
          );
        })}

        {done && (
          <section className="feed-slide is-end">
            <div className="feed-endcard">
              <p className="feed-end-emoji" aria-hidden="true">🎉</p>
              <h2>You&apos;ve seen everything in {city.name}</h2>
              <p>New events land every 6 hours. Meanwhile, narrow it down your way.</p>
              <div className="feed-end-row">
                <Link className="btn btn-primary" href="/saved">
                  Your saved ({saved.length})
                </Link>
                <Link className="btn btn-ghost" href="/vibe">
                  Pick a vibe
                </Link>
                <Link className="btn btn-ghost" href="/discover">
                  Swipe instead
                </Link>
              </div>
            </div>
          </section>
        )}
        {!items.length && !done && (
          <section className="feed-slide is-end">
            <div className="feed-endcard">
              <h2>No upcoming events found</h2>
              <p>Try another city from the top bar.</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
