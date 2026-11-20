"use client";

import { sized } from "@/lib/imageUrl";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import type { Event } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { boardCount, boardRows, pages, type BoardRow, type BoardTab } from "@/lib/board";
import { useNow } from "@/lib/clock";
import { getCategoryColor } from "@/lib/categoryColors";
import { zoneLabel } from "@/lib/formatDate";
import TodayNetwork from "./TodayNetwork";
import FlapText from "./FlapText";
import TransitionLink from "./TransitionLink";

const PAGE = 7;
const CYCLE_MS = 10_000;
const clockFor = (zone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateFor = (zone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "long", day: "numeric", month: "long" });
const catCode = (c: Event["category"]) => CATEGORIES.find((x) => x.value === c)?.label ?? "Event";

/**
 * The home page hero and the site's signature: the city as a departures
 * timetable. Rows are real events, soonest first; the NOW line sits between
 * what has started and what departs next, with the city's live time on it.
 * Tabs switch between today, tomorrow and the weekend; long boards page
 * through themselves (paused on hover or focus, never for reduced motion).
 */
export default function Timetable({
  events,
  city,
  zone = "Asia/Kolkata",
  loading,
  aside,
  lede,
}: {
  events: Event[];
  city: string;
  zone?: string;
  loading: boolean;
  /** Intro and search, set beside the rows on wide screens. */
  aside?: React.ReactNode;
  /** One line under the masthead saying what the site covers. */
  lede?: React.ReactNode;
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

  const todayWord = "Today";
  const tabs: { key: BoardTab; label: string }[] = [
    { key: "today", label: todayWord },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "weekend", label: "This weekend" },
  ];
  const heading = tabs.find((t) => t.key === tab)!.label;
  const time = now ? clockFor(zone).format(new Date(now)) : "--:--";
  // The NOW line goes after the last departure already running.
  const lastLive = current.reduce((at, r, i) => (r.tone === "live" ? i : at), -1);
  const showNow = tab === "today" && now > 0 && page % pageCount === 0;
  // A thin night: carry on into tomorrow's first departures under a rule,
  // so the board never looks empty while there is something to go to.
  const later = useMemo(
    () => (tab === "today" && now && rows.length < 3 ? boardRows(events, "tomorrow", now).slice(0, 5 - rows.length) : []),
    [tab, now, rows.length, events],
  );
  const settled = !loading && now > 0;

  return (
    <section
      className="tt"
      aria-labelledby="tt-title"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <header className="tt-mast">
        <p className="tt-kicker">
          <span className="tt-kicker-code">Every kind of event</span>
          <span>{now ? dateFor(zone).format(new Date(now)) : " "}</span>
        </p>
        <h1 id="tt-title" className="tt-title">
          <span className="tt-word">What&apos;s on</span> <span
            className="tt-in"
            // Long names ("Thiruvananthapuram") shrink to fit rather than break mid-word.
            style={{ "--city-len": Math.max(6, ...`in ${city}`.split(/\s+/).map((w) => w.length)) } as React.CSSProperties}
          >
            in {city}
          </span>
        </h1>
        {lede && <p className="tt-lede">{lede}</p>}
        <div className="tt-clock">
          <FlapText text={time} length={5} className="tt-clock-face" label={now ? `Time in ${city}: ${time}` : ""} />
          <span className="tt-clock-zone">{now ? zoneLabel(zone, now) : ""}</span>
        </div>
        <TodayNetwork events={events} now={now} />
      </header>

      <div className="tt-grid">
        {aside && <div className="tt-aside">{aside}</div>}

        <div className="tt-board">
          <p className="tt-board-label">
            <span className="tt-kicker-code">Departures</span> Next up near you
          </p>
          <div className="tt-bar">
            <div className="tt-tabs" role="tablist" aria-label="When">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`tt-tab-${t.key}`}
                  aria-selected={tab === t.key}
                  aria-controls="tt-panel"
                  className="tt-tab"
                  onClick={() => choose(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="tt-count" aria-live="polite">
              {settled ? boardCount(rows.length, later.length, heading) : "Checking listings"}
            </p>
          </div>

          <div className="tt-cols" aria-hidden="true">
            <span>Time</span>
            <span>Departure</span>
            <span>Platform</span>
            <span>Status</span>
          </div>

          <div role="tabpanel" id="tt-panel" aria-labelledby={`tt-tab-${tab}`}>
            {!settled ? (
              <ol className="tt-rows is-loading" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <li key={i} className="tt-skel">
                    <span />
                    <span />
                  </li>
                ))}
              </ol>
            ) : rows.length === 0 ? (
              <div className="tt-none">
                <p className="tt-none-title">
                  No more departures {tab === "today" ? todayWord.toLowerCase() : tab === "tomorrow" ? "tomorrow" : "this weekend"} in {city}.
                </p>
                <p className="tt-none-body">Listings refresh every six hours. The next board is one tap away.</p>
                <button type="button" className="btn btn-ghost" onClick={() => choose(tab === "tomorrow" ? "weekend" : "tomorrow")}>
                  See {tab === "tomorrow" ? "the weekend" : "tomorrow"}
                </button>
              </div>
            ) : (
              <ol className="tt-rows">
                {showNow && lastLive === -1 && <NowLine time={time} />}
                {current.map((r, i) => (
                  <Fragment key={`${tab}-${r.event.id}`}>
                    <Row r={r} i={i} />
                    {showNow && i === lastLive && <NowLine time={time} />}
                  </Fragment>
                ))}
                {later.length > 0 && (
                  <>
                    <li className="tt-divider">
                      <span>Tomorrow</span>
                    </li>
                    {later.map((r, i) => (
                      <Row key={`later-${r.event.id}`} r={r} i={current.length + i} />
                    ))}
                  </>
                )}
              </ol>
            )}
          </div>

          <footer className="tt-foot">
            {pageCount > 1 ? (
              <div className="tt-pager">
                <button type="button" className="icon-btn" aria-label="Previous page" onClick={() => setPage((p) => (p - 1 + pageCount) % pageCount)}>
                  <CaretLeft size={16} weight="bold" />
                </button>
                <span aria-live="polite">
                  Page {(page % pageCount) + 1} of {pageCount}
                </span>
                <button type="button" className="icon-btn" aria-label="Next page" onClick={() => setPage((p) => (p + 1) % pageCount)}>
                  <CaretRight size={16} weight="bold" />
                </button>
              </div>
            ) : (
              <span />
            )}
            <Link href={`/explore?when=${tab}`} className="link-arrow">
              Every listing {tab === "today" ? todayWord.toLowerCase() : tab === "tomorrow" ? "tomorrow" : "this weekend"}
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </Link>
          </footer>
        </div>
      </div>
    </section>
  );
}

function Row({ r, i }: { r: BoardRow; i: number }) {
  return (
    <li
      className={`tt-row is-${r.tone}`}
      data-vt-card
      style={{ "--cat": getCategoryColor(r.event.category).color, "--i": i } as React.CSSProperties}
    >
      <TransitionLink
        href={`/events/${r.event.id}`}
        kind="event"
        preview={r.event}
        className="tt-link"
      >
        <span className="tt-time">
          {r.day && <span className="tt-day">{r.day}</span>}
          <FlapText
            text={r.time === "ALL DAY" ? "--:--" : r.time}
            label={r.time === "ALL DAY" ? "Time TBA" : r.time}
            length={5}
            delay={Math.min(i, 6) * 40}
          />
        </span>
        <span className="tt-dest">
          <span className="tt-name">{r.title}</span>
          <span className="tt-cat">{catCode(r.event.category)}</span>
        </span>
        <span className="tt-plat">
          <span className="sr-only">, at </span>
          {r.area || "Venue on listing"}
          {r.time === "ALL DAY" && <span className="tt-note"> · times on listing</span>}
        </span>
        <span className="tt-status">
          <span className="sr-only">, </span>
          {r.tone === "live" && <span className="live-dot" aria-hidden="true" />}
          {r.status}
        </span>
        {r.event.image_url && (
          <img
            className="tt-peek"
            data-vt-media
            src={sized(r.event.image_url, 240)!}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        )}
      </TransitionLink>
    </li>
  );
}

function NowLine({ time }: { time: string }) {
  return (
    <li className="tt-now" aria-label={`Now, ${time}`}>
      <span className="tt-now-tag">Now</span>
      <span className="tt-now-time">{time}</span>
      <span className="tt-now-rule" aria-hidden="true" />
    </li>
  );
}
