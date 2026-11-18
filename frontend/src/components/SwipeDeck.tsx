"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";
import {
  ArrowCounterClockwise,
  ArrowUp,
  Clock,
  Fire,
  Heart,
  MapPin,
  Sparkle,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import EventImage from "./EventImage";
import { useCity } from "@/lib/cityPref";
import { useCityEvents } from "@/hooks/useCityEvents";
import {
  COLD_START,
  markSeen,
  rankForDeck,
  readTaste,
  recordSignal,
  resetSeen,
  resetTaste,
  scoreEvent,
  tasteSummary,
  unmarkSeen,
  useTaste,
  type Signal,
} from "@/lib/taste";
import { ensureSaved, toggleSaved } from "@/lib/saved";
import { touchStreak, useStreak } from "@/lib/streak";
import { formatWhen } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import { whatsappUrl } from "@/lib/share";
import ShareCard from "./ShareCard";
import { CATEGORIES, type Event } from "@/lib/types";

type Action = Exclude<Signal, "dwell" | "open">;
const ROUND = 40;
const CHECKIN_EVERY = 10;
const FLY: Record<Action | "open", { x: number; y: number; r: number }> = {
  save: { x: 640, y: 40, r: 18 },
  skip: { x: -640, y: 40, r: -18 },
  notnow: { x: 0, y: 640, r: 0 },
  open: { x: 0, y: -640, r: 0 },
};
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
const SLOT_TEXT = { morning: "mornings", afternoon: "afternoons", evening: "evenings", night: "late nights" } as const;
const PRICE_TEXT = { free: "free events", low: "under ₹500", mid: "₹500 to ₹2,000", high: "premium picks" } as const;

interface Step { event: Event; action: Action }

export default function SwipeDeck() {
  const router = useRouter();
  const city = useCity();
  const pool = useCityEvents(city, { limit: 100 });
  const taste = useTaste();
  const streak = useStreak();
  const reduce = useReducedMotion() ?? false;

  const [deck, setDeck] = useState<Event[] | null>(null);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Step[]>([]);
  const [shortlist, setShortlist] = useState<Event[]>([]);
  const [fly, setFly] = useState<Action | "open" | null>(null);
  const [checkin, setCheckin] = useState(false);
  const [announce, setAnnounce] = useState("");

  // Build a round once the events arrive, ranked by the taste at that moment.
  // The order is frozen for the round so cards never jump under the thumb.
  const deal = useCallback(() => {
    setDeck(rankForDeck(pool.events, readTaste()).slice(0, ROUND));
    setIndex(0);
    setHistory([]);
  }, [pool.events]);

  // Deal a fresh round whenever a new set of events arrives (city change).
  const [dealtFrom, setDealtFrom] = useState<Event[] | null>(null);
  if (!pool.loading && dealtFrom !== pool.events) {
    setDealtFrom(pool.events);
    setDeck(rankForDeck(pool.events, readTaste()).slice(0, ROUND));
    setIndex(0);
    setHistory([]);
  }

  const top = deck?.[index] ?? null;
  const ended = deck !== null && index >= deck.length;
  const warm = taste.signals >= COLD_START;

  // Dwell: lingering on a card is a soft "interested".
  useEffect(() => {
    if (!top || checkin) return;
    const t = window.setTimeout(() => recordSignal(top, "dwell"), 4000);
    return () => window.clearTimeout(t);
  }, [top, checkin]);

  const commit = useCallback(
    (action: Action | "open") => {
      if (!top) return;
      setFly(null);
      touchStreak();
      markSeen(top.id);
      if (action === "open") {
        recordSignal(top, "open");
        router.push(`/events/${top.id}`);
        return;
      }
      recordSignal(top, action);
      sfx(action === "save" ? "pop" : "swipe");
      if (action === "save") {
        ensureSaved(top);
        setShortlist((s) => [top, ...s.filter((e) => e.id !== top.id)]);
        setAnnounce(`Saved ${top.title}`);
      } else {
        setAnnounce(action === "skip" ? `Skipped ${top.title}` : `Maybe later: ${top.title}`);
      }
      setHistory((h) => [...h, { event: top, action }]);
      const next = index + 1;
      setIndex(next);
      if (next % CHECKIN_EVERY === 0 && deck && next < deck.length) setCheckin(true);
    },
    [top, index, deck, router],
  );

  const act = useCallback(
    (action: Action | "open") => {
      if (!top || fly || checkin) return;
      if (reduce) commit(action);
      else setFly(action);
    },
    [top, fly, checkin, reduce, commit],
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last || fly) return;
    recordSignal(last.event, last.action, -1);
    unmarkSeen(last.event.id);
    if (last.action === "save") {
      toggleSaved(last.event);
      setShortlist((s) => s.filter((e) => e.id !== last.event.id));
    }
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => i - 1);
    setCheckin(false);
    setAnnounce(`Brought back ${last.event.title}`);
  }, [history, fly]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (checkin && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        setCheckin(false);
        return;
      }
      const map: Record<string, Action | "open"> = {
        ArrowRight: "save",
        ArrowLeft: "skip",
        ArrowDown: "notnow",
        ArrowUp: "open",
      };
      if (map[e.key]) {
        e.preventDefault();
        act(map[e.key]);
      } else if ((e.key === "z" && (e.metaKey || e.ctrlKey)) || e.key === "Backspace") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, undo, checkin]);

  const total = deck?.length ?? 0;

  return (
    <main className="disc">
      <div className="disc-head shell">
        <div>
          <p className="disc-kicker">
            <Sparkle size={14} weight="fill" aria-hidden="true" /> Discover in {city.name}
          </p>
          <h1 className="disc-title">Swipe to find your next plan</h1>
        </div>
        <div className="disc-stats" aria-label="Your progress">
          {streak > 1 && (
            <span className="disc-pill is-fire" title="Days in a row">
              <Fire size={14} weight="fill" aria-hidden="true" /> {streak}-day streak
            </span>
          )}
          <span className="disc-pill">
            <Heart size={14} weight="fill" aria-hidden="true" /> {shortlist.length} saved
          </span>
        </div>
      </div>

      {total > 0 && !ended && (
        <div className="shell disc-progress" aria-hidden="true">
          <div className="disc-bar">
            <span style={{ transform: `scaleX(${index / total})` }} />
          </div>
          <span className="disc-count">
            {index + 1} of {total}
          </span>
        </div>
      )}

      {pool.isSample && (
        <div className="shell">
          <p className="notice">Live data is unreachable right now, so these are sample events.</p>
        </div>
      )}

      <div className="disc-stage shell">
        {deck === null ? (
          <div className="disc-stack">
            <div className="disc-card is-skeleton" aria-label="Loading events" />
          </div>
        ) : ended ? (
          <Shortlist
            events={shortlist}
            empty={deck.length === 0}
            onMore={deal}
            onResetSeen={() => {
              resetSeen();
              deal();
            }}
            onResetTaste={() => {
              resetTaste();
              deal();
            }}
          />
        ) : checkin ? (
          <TasteCheckin count={index} onContinue={() => setCheckin(false)} />
        ) : (
          <>
            <div className="disc-stack">
              {deck
                .slice(index, index + 3)
                .reverse()
                .map((e, i, arr) => {
                  const depth = arr.length - 1 - i;
                  return depth === 0 ? (
                    <TopCard
                      key={e.id}
                      event={e}
                      match={warm ? scoreEvent(e, taste) : null}
                      fly={fly}
                      reduce={reduce}
                      onFlown={commit}
                      onSwipe={act}
                    />
                  ) : (
                    <div
                      key={e.id}
                      className="disc-card is-behind"
                      style={{ transform: `translateY(${depth * 14}px) scale(${1 - depth * 0.05})`, zIndex: 3 - depth }}
                      aria-hidden="true"
                    >
                      <EventImage src={e.image_url} category={e.category} ratio="3 / 4" />
                    </div>
                  );
                })}
            </div>

            {!warm && (
              <p className="disc-hint">
                Learning your taste: {Math.max(0, COLD_START - taste.signals)} more to go before match scores show.
              </p>
            )}

            <div className="disc-actions" role="group" aria-label="Decide on this event">
              <button className="disc-btn is-undo" onClick={undo} disabled={!history.length} aria-label="Undo last swipe">
                <ArrowCounterClockwise size={20} weight="bold" />
              </button>
              <button className="disc-btn is-skip" onClick={() => act("skip")} aria-label="Skip (left arrow)">
                <X size={26} weight="bold" />
              </button>
              <button className="disc-btn is-later" onClick={() => act("notnow")} aria-label="Not now (down arrow)">
                <Clock size={20} weight="bold" />
              </button>
              <button className="disc-btn is-open" onClick={() => act("open")} aria-label="Open details (up arrow)">
                <ArrowUp size={20} weight="bold" />
              </button>
              <button className="disc-btn is-save" onClick={() => act("save")} aria-label="Save (right arrow)">
                <Heart size={26} weight="fill" />
              </button>
            </div>
            <p className="disc-keys" aria-hidden="true">
              Drag the card or use arrow keys. ← skip · → save · ↑ details · ↓ not now
            </p>
          </>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </main>
  );
}

function TopCard({
  event,
  match,
  fly,
  reduce,
  onFlown,
  onSwipe,
}: {
  event: Event;
  match: { score: number; reasons: string[] } | null;
  fly: Action | "open" | null;
  reduce: boolean;
  onFlown: (a: Action | "open") => void;
  onSwipe: (a: Action | "open") => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useMotionValue(0);
  const dragRotate = useTransform(x, [-240, 240], [-14, 14]);
  const saveGlow = useTransform(x, [30, 140], [0, 1]);
  const skipGlow = useTransform(x, [-140, -30], [1, 0]);
  const upGlow = useTransform(y, [-140, -30], [1, 0]);
  const flying = useRef(false);

  useEffect(() => dragRotate.on("change", (v) => !flying.current && rotate.set(v)), [dragRotate, rotate]);

  useEffect(() => {
    if (!fly || flying.current) return;
    flying.current = true;
    const t = FLY[fly];
    const opts = { duration: 0.32, ease: [0.4, 0, 0.2, 1] as const };
    Promise.all([animate(x, t.x, opts), animate(y, t.y, opts), animate(rotate, t.r, opts)]).then(() => onFlown(fly));
  }, [fly, x, y, rotate, onFlown]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset: o, velocity: v } = info;
    if (o.x > 120 || v.x > 700) onSwipe("save");
    else if (o.x < -120 || v.x < -700) onSwipe("skip");
    else if (o.y < -130 || v.y < -800) onSwipe("open");
    else if (o.y > 130 || v.y > 800) onSwipe("notnow");
    else {
      animate(x, 0, { type: "spring", stiffness: 420, damping: 30 });
      animate(y, 0, { type: "spring", stiffness: 420, damping: 30 });
    }
  };

  return (
    <motion.article
      className="disc-card is-top"
      data-cursor="Drag"
      style={{ x, y, rotate, zIndex: 3 }}
      drag={!reduce}
      dragElastic={0.9}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      initial={reduce ? { opacity: 0 } : { scale: 0.95, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.25 }}
      whileDrag={{ cursor: "grabbing" }}
      aria-label={event.title}
    >
      <EventImage src={event.image_url} alt="" category={event.category} ratio="3 / 4" priority />
      <motion.div className="disc-glow is-save" style={{ opacity: saveGlow }} aria-hidden="true">
        <span>Save</span>
      </motion.div>
      <motion.div className="disc-glow is-skip" style={{ opacity: skipGlow }} aria-hidden="true">
        <span>Skip</span>
      </motion.div>
      <motion.div className="disc-glow is-open" style={{ opacity: upGlow }} aria-hidden="true">
        <span>Details</span>
      </motion.div>

      {match && (
        <div className="disc-match" title="How well this fits what you've liked">
          <strong>{match.score}%</strong> match
        </div>
      )}

      <div className="disc-info">
        <div className="disc-tags">
          <span className="disc-tag">{CAT_LABEL[event.category] ?? event.category}</span>
          <span className="disc-tag is-price">{priceBadge(event)}</span>
          {match?.reasons.map((r) => (
            <span key={r} className="disc-tag is-reason">
              {r}
            </span>
          ))}
        </div>
        <h2 className="disc-name">{event.title}</h2>
        <p className="disc-meta">
          <Clock size={14} weight="bold" aria-hidden="true" /> {formatWhen(event.start_time)}
        </p>
        {event.location_name && (
          <p className="disc-meta">
            <MapPin size={14} weight="bold" aria-hidden="true" /> {event.location_name}
          </p>
        )}
      </div>
    </motion.article>
  );
}

function TasteCheckin({ count, onContinue }: { count: number; onContinue: () => void }) {
  const s = tasteSummary(useTaste());
  const max = Math.max(1, ...s.cats.map((c) => c.weight));
  return (
    <div className="disc-panel" role="dialog" aria-labelledby="checkin-title">
      <p className="disc-kicker">{count} swiped</p>
      <h2 id="checkin-title" className="disc-panel-title">
        Your taste so far
      </h2>
      {s.cats.length ? (
        <ul className="disc-taste">
          {s.cats.map((c) => (
            <li key={c.value}>
              <span>{c.label}</span>
              <span className="disc-taste-bar">
                <span style={{ width: `${(c.weight / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="disc-panel-copy">Nothing stands out yet. Save a few more and patterns show up.</p>
      )}
      {(s.slot || s.price) && (
        <p className="disc-panel-copy">
          You lean towards {[s.slot && SLOT_TEXT[s.slot], s.price && PRICE_TEXT[s.price]].filter(Boolean).join(" and ")}.
        </p>
      )}
      <button className="btn btn-primary" onClick={onContinue} autoFocus>
        Keep swiping
      </button>
    </div>
  );
}

function Shortlist({
  events,
  empty,
  onMore,
  onResetSeen,
  onResetTaste,
}: {
  events: Event[];
  empty: boolean;
  onMore: () => void;
  onResetSeen: () => void;
  onResetTaste: () => void;
}) {
  const interests = useMemo(() => [...new Set(events.map((e) => e.category))].join(","), [events]);
  const share = useMemo(() => {
    if (typeof window === "undefined") return "#";
    const lines = events.slice(0, 8).map((e) => `• ${e.title} (${formatWhen(e.start_time)})\n  ${window.location.origin}/events/${e.id}`);
    return whatsappUrl(`My shortlist from Elsewhere:\n\n${lines.join("\n")}`);
  }, [events]);

  if (empty) {
    return (
      <div className="disc-panel">
        <h2 className="disc-panel-title">You&apos;ve seen everything here</h2>
        <p className="disc-panel-copy">Try another city from the top bar, or start the deck over.</p>
        <div className="disc-row">
          <button className="btn btn-primary" onClick={onResetSeen}>
            Start over
          </button>
          <Link className="btn btn-ghost" href="/explore">
            Explore instead
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="disc-panel is-wide">
      <h2 className="disc-panel-title">{events.length ? `Your shortlist (${events.length})` : "Nothing saved this round"}</h2>
      {events.length > 0 ? (
        <ul className="disc-list">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="disc-list-item">
                <EventImage src={e.image_url} category={e.category} ratio="1 / 1" className="disc-thumb" />
                <span>
                  <strong>{e.title}</strong>
                  <small>
                    {formatWhen(e.start_time)} · {priceBadge(e)}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="disc-panel-copy">Swipe right on anything that looks fun and it lands here.</p>
      )}
      <div className="disc-row">
        {events.length > 0 && (
          <>
            <Link className="btn btn-primary" href={`/plan-my-day?interests=${interests}`}>
              <Sparkle size={16} weight="fill" aria-hidden="true" /> Plan my day with these
            </Link>
            <a className="btn btn-ghost" href={share} target="_blank" rel="noopener noreferrer">
              <WhatsappLogo size={16} weight="fill" aria-hidden="true" /> Share
            </a>
            <ShareCard ids={events.map((e) => e.id)} title="My shortlist" kicker="Swiped on Elsewhere" label="Make a card" />
          </>
        )}
        <button className="btn btn-ghost" onClick={onMore}>
          Keep swiping
        </button>
      </div>
      <button className="disc-link" onClick={onResetTaste}>
        Reset my taste
      </button>
    </div>
  );
}
