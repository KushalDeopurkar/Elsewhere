"use client";

/**
 * Home scroll story: five ways to find a plan, each with a small live demo
 * built from real events. On wide screens the demo stage pins while the
 * steps scroll past; on phones and with reduced motion the steps stack and
 * each demo plays when it comes into view. Demos are decorative; the step
 * text and links carry the meaning.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import {
  ArrowRight,
  Cards,
  Clock,
  Heart,
  MagnifyingGlass,
  MapPin,
  Smiley,
  Sparkle,
  MapTrifold,
  X,
  Car,
} from "@phosphor-icons/react";
import type { Event } from "@/lib/types";
import EventImage from "./EventImage";
import { formatWhen } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import { getCategoryColor } from "@/lib/categoryColors";

interface Step {
  id: string;
  kicker: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  Icon: typeof Cards;
}

const STEPS: Step[] = [
  {
    id: "search",
    kicker: "Search like you talk",
    title: "Say what you feel like doing.",
    body: "Plain English or Hinglish. It works out the what, where and when, and finds events by meaning, not just keywords.",
    href: "/explore?focus=1",
    cta: "Try a search",
    Icon: MagnifyingGlass,
  },
  {
    id: "swipe",
    kicker: "Swipe",
    title: "Right to save, left to skip.",
    body: "One event at a time. Every swipe teaches it your taste, so the next card fits a little better.",
    href: "/discover",
    cta: "Start swiping",
    Icon: Cards,
  },
  {
    id: "vibe",
    kicker: "Pick a vibe",
    title: "Chill, social, wild or curious.",
    body: "Mix moods, slide your budget and distance, and watch the results rearrange as you go.",
    href: "/vibe",
    cta: "Pick a vibe",
    Icon: Smiley,
  },
  {
    id: "map",
    kicker: "Play the week",
    title: "Watch the city light up.",
    body: "Scrub through the next seven days on the map. What's on right now pulses, with live travel time to the door.",
    href: "/map",
    cta: "Open the map",
    Icon: MapTrifold,
  },
  {
    id: "plan",
    kicker: "Plan my day",
    title: "Let AI build the whole day.",
    body: "Tell it your time, budget and interests. It picks real events, orders them so you make each one, and maps the route.",
    href: "/plan-my-day",
    cta: "Plan my day",
    Icon: Sparkle,
  },
];

function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1000px) and (prefers-reduced-motion: no-preference)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export default function ScrollStory({ events }: { events: Event[] }) {
  const wide = useWide();
  const pool = useMemo(() => {
    const withImg = events.filter((e) => e.image_url);
    return (withImg.length >= 6 ? withImg : events).slice(0, 12);
  }, [events]);
  if (pool.length < 3) return null;
  return wide ? <Pinned pool={pool} /> : <Stacked pool={pool} />;
}

function Pinned({ pool }: { pool: Event[] }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  // Only the step index goes through React (5 changes per pass); the rail
  // follows the scroll as a motion value, straight to the compositor.
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = Math.min(STEPS.length - 1, Math.max(0, Math.floor(p * STEPS.length)));
    setActive((cur) => (cur === next ? cur : next));
  });

  return (
    <section ref={ref} className="story" style={{ height: `${STEPS.length * 85 + 15}vh` }} aria-labelledby="story-title">
      <div className="story-pin">
        <div className="shell story-grid">
          <div className="story-copy">
            <h2 id="story-title" className="story-title">
              Five ways to find <em>your</em> plan
            </h2>
            <ol className="story-steps">
              {STEPS.map((s, i) => (
                <li key={s.id} className={`story-step${i === active ? " is-on" : ""}`} aria-current={i === active ? "step" : undefined}>
                  <span className="story-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="story-kicker">
                      <s.Icon size={14} weight="bold" aria-hidden="true" /> {s.kicker}
                    </p>
                    <h3 className="story-step-title">{s.title}</h3>
                    <div className="story-more">
                      <p>{s.body}</p>
                      <Link href={s.href} className="story-cta">
                        {s.cta} <ArrowRight size={14} weight="bold" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="story-bar" aria-hidden="true">
              <motion.span style={{ scaleY: scrollYProgress }} />
            </div>
          </div>
          <div className="story-stage" aria-hidden="true">
            <AnimatePresence mode="wait">
              <motion.div
                key={STEPS[active].id}
                className="story-demo"
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -24, scale: 0.98 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <Demo id={STEPS[active].id} pool={pool} active />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stacked({ pool }: { pool: Event[] }) {
  return (
    <section className="story is-stacked shell" aria-labelledby="story-title">
      <h2 id="story-title" className="story-title">
        Five ways to find <em>your</em> plan
      </h2>
      <ol className="story-steps">
        {STEPS.map((s, i) => (
          <StackedStep key={s.id} step={s} n={i + 1} pool={pool} />
        ))}
      </ol>
    </section>
  );
}

function StackedStep({ step: s, n, pool }: { step: Step; n: number; pool: Event[] }) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  return (
    <li ref={ref} className="story-step is-on">
      <span className="story-num" aria-hidden="true">
        {String(n).padStart(2, "0")}
      </span>
      <div>
        <p className="story-kicker">
          <s.Icon size={14} weight="bold" aria-hidden="true" /> {s.kicker}
        </p>
        <h3 className="story-step-title">{s.title}</h3>
        <p className="story-body">{s.body}</p>
        <div className="story-demo is-inline" aria-hidden="true">
          <Demo id={s.id} pool={pool} active={inView} />
        </div>
        <Link href={s.href} className="story-cta">
          {s.cta} <ArrowRight size={14} weight="bold" aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

function Demo({ id, pool, active }: { id: string; pool: Event[]; active: boolean }) {
  switch (id) {
    case "search":
      return <SearchDemo pool={pool} active={active} />;
    case "swipe":
      return <SwipeDemo pool={pool} active={active} />;
    case "vibe":
      return <VibeDemo pool={pool} active={active} />;
    case "map":
      return <MapDemo pool={pool} active={active} />;
    default:
      return <PlanDemo pool={pool} active={active} />;
  }
}

/** Ticks while active (and motion allowed); returns the tick count. */
function useTick(active: boolean, ms: number): number {
  const reduce = useReducedMotion() ?? false;
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active || reduce) return;
    const id = window.setInterval(() => setN((x) => x + 1), ms);
    return () => window.clearInterval(id);
  }, [active, reduce, ms]);
  return n;
}

const QUERIES = ["free comedy tonight near Bandra", "AI meetups this weekend", "kal shaam live music aur khana"];

function SearchDemo({ pool, active }: { pool: Event[]; active: boolean }) {
  const tick = useTick(active, 70);
  const cycle = 70; // ticks per query (about 5 s)
  const q = QUERIES[Math.floor(tick / cycle) % QUERIES.length];
  const t = tick % cycle;
  const typed = q.slice(0, Math.min(q.length, t));
  const done = t > q.length + 4;
  const start = (Math.floor(tick / cycle) * 3) % Math.max(1, pool.length - 3);
  const results = pool.slice(start, start + 3);
  return (
    <div className="dm dm-search">
      <div className="dm-input">
        <MagnifyingGlass size={16} weight="bold" />
        <span>
          {typed || (tick === 0 ? q : "")}
          <i className="dm-caret" />
        </span>
      </div>
      <div className="dm-results">
        <AnimatePresence>
          {(done || tick === 0) &&
            results.map((e, i) => (
              <motion.div
                key={`${e.id}-${Math.floor(tick / cycle)}`}
                className="dm-row"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <EventImage src={e.image_url} category={e.category} ratio="1 / 1" className="dm-thumb" />
                <span>
                  <strong>{e.title}</strong>
                  <small>
                    {formatWhen(e.start_time)} · {priceBadge(e)}
                  </small>
                </span>
                <em className="dm-score">{96 - i * 7}%</em>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SwipeDemo({ pool, active }: { pool: Event[]; active: boolean }) {
  const tick = useTick(active, 1500);
  const top = tick % pool.length;
  const dir = tick % 3 === 1 ? -1 : 1;
  const cards = [0, 1, 2].map((k) => pool[(top + k) % pool.length]);
  return (
    <div className="dm dm-swipe">
      <div className="dm-stack">
        <AnimatePresence initial={false}>
        {cards
          .slice()
          .reverse()
          .map((e, ri) => {
            const depth = 2 - ri;
            return (
              <motion.div
                key={`${e.id}-${tick + depth}`}
                className="dm-card"
                initial={depth === 0 ? { scale: 0.95, y: 14 } : false}
                animate={{ scale: 1 - depth * 0.05, y: depth * 14, x: 0, rotate: 0, opacity: 1 }}
                exit={{ x: dir * 320, rotate: dir * 16, opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                style={{ zIndex: 3 - depth, filter: depth ? "brightness(0.6)" : undefined }}
              >
                <EventImage src={e.image_url} category={e.category} ratio="3 / 4" />
                {depth === 0 && (
                  <div className="dm-card-info">
                    <span className="dm-tag">{92 - (tick % 5) * 4}% match</span>
                    <strong>{e.title}</strong>
                    <small>{formatWhen(e.start_time)}</small>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="dm-swipe-btns">
        <span className={`dm-round is-skip${dir < 0 ? " is-hit" : ""}`} key={`s${tick}`}>
          <X size={20} weight="bold" />
        </span>
        <span className={`dm-round is-save${dir > 0 ? " is-hit" : ""}`} key={`h${tick}`}>
          <Heart size={20} weight="fill" />
        </span>
      </div>
    </div>
  );
}

const MOODS = [
  { id: "chill", label: "Chill", hue: "oklch(0.78 0.13 160)" },
  { id: "social", label: "Social", hue: "oklch(0.78 0.14 20)" },
  { id: "learn", label: "Learn", hue: "oklch(0.75 0.13 250)" },
  { id: "wild", label: "Wild", hue: "oklch(0.72 0.2 35)" },
];

function VibeDemo({ pool, active }: { pool: Event[]; active: boolean }) {
  const tick = useTick(active, 1700);
  const on = new Set([MOODS[tick % 4].id, MOODS[(tick + 2) % 4].id].slice(0, 1 + (tick % 2)));
  const order = useMemo(() => pool.slice(0, 6), [pool]);
  const shown = order
    .map((e, i) => ({ e, k: (i * 7 + tick * 5) % 11 }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 3 + (tick % 3));
  return (
    <div className="dm dm-vibe">
      <div className="dm-moods">
        {MOODS.map((m) => (
          <span
            key={m.id}
            className={`dm-mood${on.has(m.id) ? " is-on" : ""}`}
            style={{ "--hue": m.hue } as React.CSSProperties}
          >
            {m.label}
          </span>
        ))}
      </div>
      <p className="dm-count">
        <motion.strong key={shown.length} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          {shown.length * 4 + 3}
        </motion.strong>{" "}
        events match
      </p>
      <motion.div className="dm-grid" layout>
        <AnimatePresence mode="popLayout">
          {shown.map(({ e }) => (
            <motion.div
              key={e.id}
              layout
              className="dm-tile"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            >
              <EventImage src={e.image_url} category={e.category} ratio="4 / 3" />
              <strong>{e.title}</strong>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function MapDemo({ pool, active }: { pool: Event[]; active: boolean }) {
  const tick = useTick(active, 90);
  const pos = (tick % 120) / 120;
  const dots = useMemo(
    () =>
      pool.map((e, i) => ({
        e,
        x: 12 + ((i * 37 + e.id.length * 13) % 76),
        y: 14 + ((i * 53 + e.title.length * 7) % 68),
        at: ((i * 0.137 + 0.05) % 1),
      })),
    [pool],
  );
  const labels = ["Today", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];
  return (
    <div className="dm dm-map">
      <div className="dm-mapbox">
        <svg className="dm-roads" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0 62 C 25 55, 40 70, 60 58 S 90 40, 100 44" />
          <path d="M18 0 C 22 30, 35 45, 30 100" />
          <path d="M55 0 C 58 25, 70 50, 82 100" />
          <path d="M0 28 C 30 30, 60 22, 100 26" />
        </svg>
        {dots.map((d) => {
          const near = Math.abs(d.at - pos) < 0.12;
          const live = Math.abs(d.at - pos) < 0.05;
          return (
            <span
              key={d.e.id}
              className={`dm-dot${near ? " is-on" : ""}${live ? " is-live" : ""}`}
              style={{ left: `${d.x}%`, top: `${d.y}%`, "--c": getCategoryColor(d.e.category).color } as React.CSSProperties}
            />
          );
        })}
        <span className="dm-mapchip">
          <MapPin size={12} weight="fill" /> {dots.filter((d) => Math.abs(d.at - pos) < 0.12).length} on now
        </span>
      </div>
      <div className="dm-timeline">
        <div className="dm-bars">
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} style={{ height: `${20 + ((i * 37) % 70)}%` }} className={i / 28 < pos ? "is-past" : undefined} />
          ))}
          <i className="dm-head" style={{ left: `${pos * 100}%` }} />
        </div>
        <div className="dm-days">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanDemo({ pool, active }: { pool: Event[]; active: boolean }) {
  const tick = useTick(active, 900);
  const shown = Math.min(3, tick % 6);
  const stops = pool.slice(0, 3);
  const times = ["4:00 pm", "6:30 pm", "9:00 pm"];
  const travel = ["14 min drive", "9 min walk"];
  return (
    <div className="dm dm-plan">
      <p className="dm-prompt">
        <Sparkle size={14} weight="fill" /> Saturday in Mumbai under ₹1,500, music and food
      </p>
      <ol className="dm-stops">
        {stops.map((e, i) => (
          <motion.li
            key={e.id}
            initial={false}
            animate={{ opacity: i < shown || active === false ? 1 : 0.15, x: i < shown || !active ? 0 : 12 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="dm-time">
              <Clock size={12} weight="bold" /> {times[i]}
            </span>
            <div className="dm-stop">
              <EventImage src={e.image_url} category={e.category} ratio="1 / 1" className="dm-thumb" />
              <span>
                <strong>{e.title}</strong>
                <small>{e.location_name ?? priceBadge(e)}</small>
              </span>
            </div>
            {i < 2 && (
              <span className="dm-travel">
                <Car size={12} weight="bold" /> {travel[i]}
              </span>
            )}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
