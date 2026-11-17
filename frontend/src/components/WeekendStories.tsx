"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, CaretLeft, CaretRight, MapPin, Pause, Play, X } from "@phosphor-icons/react/ssr";
import type { Event } from "@/lib/types";
import { pickStories } from "@/lib/stories";
import { formatWhen, hasTime } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import { getCategoryColor } from "@/lib/categoryColors";
import { CATEGORIES } from "@/lib/types";
import { startCountdown } from "@/lib/countdown";
import { useNow } from "@/lib/clock";
import { createStore } from "@/lib/clientStore";
import { rememberPreview } from "@/lib/eventPreview";
import { recordSignal } from "@/lib/taste";
import { playAmbient, sfx, stopAmbient } from "@/lib/sound";
import SaveButton from "./SaveButton";
import "./stories.css";

const STORY_MS = 6500;
const HOLD_MS = 180;
const seenStore = createStore<string[]>("ee.stories.seen.v1", []);
const catLabel = (c: Event["category"]) => CATEGORIES.find((x) => x.value === c)?.label ?? "Event";

/**
 * "This weekend" as full-screen stories: a tray of rings on the home page
 * opens a player with progress bars and auto-advance. Tap the sides to move,
 * hold to pause, swipe up to open the event, swipe down (or Esc) to close.
 * Reduced motion keeps the player but drops the slow zoom.
 */
export default function WeekendStories({ events, city }: { events: Event[]; city: string }) {
  const { events: stories, label } = useMemo(() => pickStories(events), [events]);
  const seen = seenStore.useValue();
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  if (stories.length < 2) return null;
  const seenSet = new Set(seen);
  const allSeen = stories.every((e) => seenSet.has(e.id));
  // Start from the first story not watched yet.
  const firstNew = Math.max(0, stories.findIndex((e) => !seenSet.has(e.id)));

  return (
    <section className="shell stories-tray-wrap" aria-label={`${label} in ${city}, as stories`}>
      <ol className="stories-tray" role="list">
        <li>
          <button
            type="button"
            className="ws-ring is-lead"
            onClick={(e) => {
              opener.current = e.currentTarget;
              setOpen(allSeen ? 0 : firstNew);
            }}
          >
            <span className="ws-ring-art" aria-hidden="true">
              <Play size={22} weight="fill" />
            </span>
            <span className="ws-ring-label">{label.replace(/^This /, "").replace(/^\w/, (c) => c.toUpperCase())}</span>
          </button>
        </li>
        {stories.map((e, i) => (
          <li key={e.id}>
            <button
              type="button"
              className={`ws-ring${seenSet.has(e.id) ? " is-seen" : ""}`}
              aria-label={`Story ${i + 1} of ${stories.length}: ${e.title}`}
              onClick={(ev) => {
                opener.current = ev.currentTarget;
                setOpen(i);
              }}
            >
              <span className="ws-ring-art">
                <img src={e.image_url!} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              </span>
              <span className="ws-ring-label" aria-hidden="true">
                {formatWhen(e.start_time).split(",")[0]}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {open !== null && (
        <StoryPlayer
          stories={stories}
          start={open}
          label={label}
          onClose={() => {
            setOpen(null);
            opener.current?.focus();
          }}
        />
      )}
    </section>
  );
}

function StoryPlayer({
  stories,
  start,
  label,
  onClose,
}: {
  stories: Event[];
  start: number;
  label: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(start);
  const [held, setHeld] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const paused = held || userPaused || hidden;
  const dialog = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number; t: number; timer: number; held: boolean } | null>(null);
  const [dragY, setDragY] = useState(0);
  const now = useNow(15_000);
  const event = stories[index];

  const markSeen = useCallback((id: string) => {
    const list = seenStore.read();
    if (!list.includes(id)) seenStore.write([id, ...list].slice(0, 300));
  }, []);

  useEffect(() => {
    markSeen(event.id);
    playAmbient(event.category);
  }, [event.id, event.category, markSeen]);
  useEffect(() => stopAmbient, []);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0) return setIndex(0);
      if (next >= stories.length) return onClose();
      sfx("tick");
      setIndex(next);
    },
    [index, stories.length, onClose],
  );

  const openEvent = useCallback(() => {
    recordSignal(event, "open");
    rememberPreview(event);
    sfx("whoosh");
    onClose();
    router.push(`/events/${event.id}`);
  }, [event, onClose, router]);

  // Focus, scroll lock, keyboard, tab visibility.
  useEffect(() => {
    dialog.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab" && dialog.current) {
        // Keep focus inside the player.
        const items = [...dialog.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]")].filter(
          (el) => el.offsetParent !== null,
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowUp") openEvent();
      else if (e.key === " " && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        setUserPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, openEvent]);

  // Warm the next picture.
  useEffect(() => {
    const next = stories[index + 1];
    if (next?.image_url) {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.src = next.image_url;
    }
  }, [index, stories]);

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    const p = { x: e.clientX, y: e.clientY, t: e.timeStamp, held: false, timer: 0 };
    p.timer = window.setTimeout(() => {
      p.held = true;
      setHeld(true);
    }, HOLD_MS);
    press.current = p;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p) return;
    const dy = e.clientY - p.y;
    if (Math.abs(dy) > 12) {
      window.clearTimeout(p.timer);
      setDragY(dy);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    window.clearTimeout(p.timer);
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    setHeld(false);
    setDragY(0);
    if (dy < -70 && Math.abs(dy) > Math.abs(dx)) return openEvent();
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) return onClose();
    if (p.held || Math.abs(dx) > 30 || Math.abs(dy) > 30) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    go(e.clientX - box.left < box.width / 3 ? -1 : 1);
  };

  const hue = getCategoryColor(event.category);
  const countdown = now ? startCountdown(event.start_time, event.end_time, now, { hasTime: hasTime(event.start_time) }) : null;
  const where = event.location_name ?? event.city;

  return (
    <div
      className="ws-overlay"
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`${label}: stories`}
      style={{ "--cat-hue": hue.color } as React.CSSProperties}
    >
      <img className="ws-ambient" key={`a-${event.id}`} src={event.image_url!} alt="" aria-hidden="true" referrerPolicy="no-referrer" />
      <button type="button" className="ws-side is-prev" aria-label="Previous story" onClick={() => go(-1)} disabled={index === 0}>
        <CaretLeft size={22} weight="bold" />
      </button>
      <div
        className={`ws-frame${paused ? " is-paused" : ""}`}
        style={dragY ? { transform: `translate3d(0, ${dragY * 0.35}px, 0) scale(${1 - Math.min(Math.abs(dragY), 300) / 3000})` } : undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          if (press.current) window.clearTimeout(press.current.timer);
          press.current = null;
          setHeld(false);
          setDragY(0);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="ws-media" key={event.id}>
          <img className="ws-blur" src={event.image_url!} alt="" aria-hidden="true" referrerPolicy="no-referrer" />
          <img className="ws-poster" src={event.image_url!} alt="" referrerPolicy="no-referrer" draggable={false} />
        </div>
        <div className="ws-shade" aria-hidden="true" />

        <div className="ws-top">
          <div className="ws-bars" aria-hidden="true">
            {stories.map((s, i) => (
              <span key={s.id} className="ws-bar">
                <span
                  className={`ws-fill${i < index ? " is-done" : i === index ? " is-on" : ""}`}
                  key={i === index ? `on-${index}` : `off-${i}`}
                  style={i === index ? { animationDuration: `${STORY_MS}ms` } : undefined}
                  onAnimationEnd={i === index ? () => go(1) : undefined}
                />
              </span>
            ))}
          </div>
          <div className="ws-head">
            <span className="ws-kicker">
              {label} · {index + 1}/{stories.length}
            </span>
            <button
              type="button"
              className="ws-icon"
              aria-label={userPaused ? "Play stories" : "Pause stories"}
              aria-pressed={userPaused}
              onClick={() => setUserPaused((p) => !p)}
            >
              {userPaused ? <Play size={18} weight="fill" /> : <Pause size={18} weight="fill" />}
            </button>
            <button type="button" className="ws-icon" aria-label="Close stories" onClick={onClose}>
              <X size={20} weight="bold" />
            </button>
          </div>
        </div>

        <div className="ws-body" aria-live="polite">
          <p className="ws-cat">{catLabel(event.category)}</p>
          {countdown && <p className={`ws-count is-${countdown.tone}`}>{countdown.label}</p>}
          <h2 className="ws-title">{event.title}</h2>
          <p className="ws-meta">
            <span>{formatWhen(event.start_time)}</span>
            {where && (
              <span>
                <MapPin size={14} weight="fill" aria-hidden="true" /> {where}
              </span>
            )}
            <span>{priceBadge(event)}</span>
          </p>
          <div className="ws-actions">
            <button type="button" className="btn btn-primary ws-open" onClick={openEvent}>
              <ArrowUp size={16} weight="bold" aria-hidden="true" /> Open event
            </button>
            <SaveButton event={event} variant="button" />
          </div>
          <p className="ws-hint" aria-hidden="true">
            Tap sides to skip · hold to pause · swipe up to open
          </p>
        </div>
      </div>
      <button
        type="button"
        className="ws-side is-next"
        aria-label={index === stories.length - 1 ? "Close stories" : "Next story"}
        onClick={() => go(1)}
      >
        <CaretRight size={22} weight="bold" />
      </button>
    </div>
  );
}
