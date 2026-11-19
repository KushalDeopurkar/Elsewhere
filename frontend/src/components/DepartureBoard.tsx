"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import type { Event } from "@/lib/types";
import { boardRows, pages, type BoardTab } from "@/lib/board";
import { useNow } from "@/lib/clock";
import { getCategoryColor } from "@/lib/categoryColors";
import { whenOf } from "@/lib/formatDate";
import FlapText from "./FlapText";
import ScrambleText from "./ScrambleText";
import TransitionLink from "./TransitionLink";

const PAGE = 6;
const CYCLE_MS = 9000;
const clockFor = (zone: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Short zone name for the board clock: "IST", "GMT", "EST", "AEDT"… */
function zoneLabel(zone: string, at: number): string {
  if (zone === "Asia/Kolkata") return "IST";
  const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return part && !part.startsWith("GMT+") && !part.startsWith("GMT-") ? part : "LOCAL";
}

/**
 * The home page hero: a station departures board of real events. Tabs flip
 * between tonight, tomorrow and the weekend; longer boards page through
 * themselves (paused on hover or focus, and not at all for reduced motion).
 * Every row is a real link to its event.
 */
export default function DepartureBoard({
  events,
  city,
  zone = "Asia/Kolkata",
  loading,
  night,
}: {
  events: Event[];
  city: string;
  /** The city's time zone, for the board clock. */
  zone?: string;
  loading: boolean;
  night: boolean;
}) {
  const now = useNow(15_000);
  const [tab, setTab] = useState<BoardTab>("today");
  const [page, setPage] = useState(0);
  const [held, setHeld] = useState(false);

  const rows = useMemo(() => (now ? boardRows(events, tab, now) : []), [events, tab, now]);
  const book = useMemo(() => pages(rows, PAGE), [rows]);
  const pageCount = Math.max(1, book.length);
  const current = book[page % pageCount] ?? [];

  useEffect(() => {
    if (held || pageCount < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setPage((p) => (p + 1) % pageCount), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [held, pageCount]);

  const choose = (t: BoardTab) => {
    setTab(t);
    setPage(0);
  };

  const todayLabel = night ? "Tonight" : "Today";
  const tabs: { key: BoardTab; label: string }[] = [
    { key: "today", label: todayLabel },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "weekend", label: "Weekend" },
  ];
  const tabLabel = tabs.find((t) => t.key === tab)!.label;
  const exploreHref = `/explore?when=${tab}`;
  // Fixed number of row slots so the board never changes height.
  const slots = Array.from({ length: PAGE }, (_, i) => current[i] ?? null);

  return (
    <section
      className="board"
      aria-label={`${tabLabel} in ${city}: departures board`}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <header className="board-head">
        <div className="board-title">
          <span className="board-kicker">Departures</span>
          <FlapText text={city} length={Math.min(12, Math.max(6, city.length))} className="board-city" />
        </div>
        <div className="board-clock" aria-label={now ? `Time in ${city} ${clockFor(zone).format(new Date(now))}` : undefined}>
          <span className="board-clock-label">{now ? zoneLabel(zone, now) : "IST"}</span>
          <FlapText text={now ? clockFor(zone).format(new Date(now)) : "--:--"} length={5} />
        </div>
      </header>

      <div className="board-tabs" role="tablist" aria-label="When">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "is-on" : ""}
            onClick={() => choose(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="board-cols" aria-hidden="true">
        <span>Time</span>
        <span>Event</span>
        <span>Status</span>
      </div>

      <div role="tabpanel" aria-label={`${tabLabel}: ${rows.length} events`}>
      <ol className="board-rows">
        {slots.map((r, i) =>
          r ? (
            <li key={`${tab}-${r.event.id}`} className="board-row" data-vt-card style={{ "--cat": getCategoryColor(r.event.category).color } as React.CSSProperties}>
              <TransitionLink
                href={`/events/${r.event.id}`}
                kind="event"
                preview={r.event}
                className="board-link"
                aria-label={`${r.day ? `${r.day} ` : ""}${r.time === "ALL DAY" ? "all day" : r.time}, ${r.title}${r.area ? `, ${r.area}` : ""}, ${r.status.toLowerCase()}`}
              >
                <FlapText text={r.time === "ALL DAY" ? "--:--" : r.time} length={5} delay={i * 70} className="board-time" />
                <span className="board-event">
                  {r.event.image_url ? (
                    <img className="board-thumb" data-vt-media src={r.event.image_url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="board-thumb is-empty" data-vt-media />
                  )}
                  <span className="board-text">
                    <ScrambleText text={r.title} delay={120 + i * 70} className="board-name" />
                    <span className="board-area">
                      {r.day ? `${r.day} · ` : ""}
                      {r.area}
                      {r.time === "ALL DAY" ? " · time on listing" : ""}
                    </span>
                  </span>
                </span>
                <span className={`board-status is-${r.tone}`}>
                  {r.tone === "live" && <span className="live-dot" />}
                  {r.status}
                </span>
              </TransitionLink>
            </li>
          ) : (
            <li key={`empty-${i}`} className="board-row is-empty" aria-hidden="true">
              <span className="board-link">
                <FlapText text="" length={5} className="board-time" />
                <span className="board-event">
                  <span className="board-dash" />
                </span>
                <span className="board-status" />
              </span>
            </li>
          ),
        )}
      </ol>
      </div>

      {!loading && now > 0 && rows.length === 0 && (
        <div className="board-none">
          <p>No more departures {tab === "today" ? (night ? "tonight" : "today") : tab === "tomorrow" ? "tomorrow" : "this weekend"} in {city}.</p>
          {tab !== "tomorrow" && (
            <button type="button" className="btn btn-ghost" onClick={() => choose(tab === "today" ? "tomorrow" : "today")}>
              See {tab === "today" ? "tomorrow" : todayLabel.toLowerCase()}
            </button>
          )}
        </div>
      )}

      <footer className="board-foot">
        {pageCount > 1 ? (
          <div className="board-pager">
            <button type="button" aria-label="Previous page" onClick={() => setPage((p) => (p - 1 + pageCount) % pageCount)}>
              <CaretLeft size={14} weight="bold" />
            </button>
            <span aria-live="polite">
              {(page % pageCount) + 1}/{pageCount}
            </span>
            <button type="button" aria-label="Next page" onClick={() => setPage((p) => (p + 1) % pageCount)}>
              <CaretRight size={14} weight="bold" />
            </button>
          </div>
        ) : (
          <span className="board-note">{rows[0] ? `Next: ${whenOf(rows[0].event)}` : ""}</span>
        )}
        <Link href={exploreHref} className="board-all">
          All {rows.length || ""} {tabLabel.toLowerCase()} <ArrowRight size={14} weight="bold" aria-hidden="true" />
        </Link>
      </footer>
    </section>
  );
}
