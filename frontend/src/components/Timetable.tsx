"use client";

import { sized } from "@/lib/imageUrl";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import type { Event } from "@/lib/types";
import { boardCount, boardRows, pages, type BoardRow, type BoardTab } from "@/lib/board";
import { useNow } from "@/lib/clock";
import { getCategoryColor } from "@/lib/categoryColors";
import { zoneLabel } from "@/lib/formatDate";
import CategoryIcon from "./CategoryIcon";
import FlapText from "./FlapText";
import TransitionLink from "./TransitionLink";
import TryElsewhere from "./TryElsewhere";
import { cityByName } from "@/lib/cities";

const PAGE = 5;
const CYCLE_MS = 10_000;
const clockFor = (zone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateFor = (zone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "long", day: "numeric", month: "long" });

/**
 * The home page hero. On the left, what the site is and the plain-words
 * search; on the right, the city as a departures board: its name and live
 * time in split-flap tiles, today / tomorrow / the weekend, five rows a
 * page (time, poster, event, venue, price or status), paging itself every
 * ten seconds (paused on hover or focus, never for reduced motion).
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
  /** The search and facts, under the headline. */
  aside?: React.ReactNode;
  /** One line under the headline saying what the site covers. */
  lede?: React.ReactNode;
}) {
  const now = useNow(15_000);
  const cityPoint = cityByName(city);
  // Until someone picks a tab, the board shows the first one with
  // something on it: today, else tomorrow, else the weekend. After
  // midnight, or late on a quiet night, it never opens on an empty board.
  const [chosen, setChosen] = useState<BoardTab | null>(null);
  const [page, setPage] = useState(0);
  const [held, setHeld] = useState(false);

  const auto = useMemo<BoardTab>(() => {
    if (!now) return "today";
    return (["today", "tomorrow", "weekend"] as BoardTab[]).find((t) => boardRows(events, t, now).length > 0) ?? "today";
  }, [events, now]);
  const tab = chosen ?? auto;

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
    setChosen(t);
    setPage(0);
  };

  const tabs: { key: BoardTab; label: string; word: string }[] = [
    { key: "today", label: "Today", word: "today" },
    { key: "tomorrow", label: "Tomorrow", word: "tomorrow" },
    { key: "weekend", label: "Weekend", word: "this weekend" },
  ];
  const active = tabs.find((t) => t.key === tab)!;
  const time = now ? clockFor(zone).format(new Date(now)) : "--:--";
  // The NOW line goes after the last departure already running.
  const lastLive = current.reduce((at, r, i) => (r.tone === "live" ? i : at), -1);
  const showNow = tab === "today" && now > 0 && page % pageCount === 0;
  // A thin night: carry on into tomorrow's first departures under a rule,
  // so the board never looks empty while there is something to go to.
  const later = useMemo(
    () => (tab === "today" && now && rows.length < 3 ? boardRows(events, "tomorrow", now).slice(0, PAGE - rows.length) : []),
    [tab, now, rows.length, events],
  );
  const settled = !loading && now > 0;
  // The board's name: the city in tiles, long names shortened to fit.
  const board = city.toUpperCase().replace(/[^A-Z ]/g, "").slice(0, 11).trim() || "DEPARTURES";

  return (
    <section className="hero" aria-labelledby="tt-title">
      <div className="hero-copy">
        <p className="tt-kicker">
          <span className="tt-kicker-code">Every kind of event</span>
          <span>{now ? dateFor(zone).format(new Date(now)) : " "}</span>
        </p>
        <h1 id="tt-title" className="tt-title hero-title">
          <span className="tt-word">Where to be</span> <span
            className="tt-in"
            // Long names ("Thiruvananthapuram") shrink to fit rather than break mid-word.
            style={{ "--city-len": Math.max(6, ...`in ${city}`.split(/\s+/).map((w) => w.length)) } as React.CSSProperties}
          >
            in {city}
          </span>
        </h1>
        {lede && <p className="hero-lede">{lede}</p>}
        {aside && <div className="hero-ask">{aside}</div>}
      </div>

      <div
        className="dep"
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocusCapture={() => setHeld(true)}
        onBlurCapture={() => setHeld(false)}
      >
        <header className="dep-head">
          <div className="dep-name">
            <p className="dep-label" id="dep-label">Departures</p>
            <FlapText text={board} length={board.length} className="dep-city" label={`${city} departures`} />
          </div>
          <div className="dep-clock">
            <span className="dep-zone">{now ? zoneLabel(zone, now) : ""}</span>
            <FlapText text={time} length={5} className="dep-time" label={now ? `Time in ${city}: ${time}` : ""} />
          </div>
        </header>

        <div className="dep-tabs" role="tablist" aria-label="When">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`dep-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls="dep-panel"
              className="dep-tab"
              onClick={() => choose(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="dep-cols" aria-hidden="true">
          <span>Time</span>
          <span>Event</span>
          <span>Status</span>
        </div>

        <div role="tabpanel" id="dep-panel" aria-labelledby={`dep-tab-${tab}`} className="dep-panel">
          <p className="sr-only" aria-live="polite">
            {settled ? boardCount(rows.length, later.length, active.label) : "Checking listings"}
          </p>
          {!settled ? (
            <ol className="dep-rows is-loading" aria-hidden="true">
              {Array.from({ length: PAGE }, (_, i) => (
                <li key={i} className="dep-skel">
                  <span />
                  <span />
                  <span />
                </li>
              ))}
            </ol>
          ) : rows.length === 0 && later.length === 0 ? (
            <div className="dep-none">
              <p className="dep-none-title">
                No more departures {active.word} in {city}.
              </p>
              <p className="dep-none-body">Listings refresh every day. The next board is one tap away.</p>
              <button type="button" className="btn btn-ghost" onClick={() => choose(tab === "tomorrow" ? "weekend" : "tomorrow")}>
                See {tab === "tomorrow" ? "the weekend" : "tomorrow"}
              </button>
              {cityPoint && <TryElsewhere city={cityPoint} lead="Or be elsewhere:" />}
            </div>
          ) : (
            <ol className="dep-rows">
              {showNow && lastLive === -1 && rows.length > 0 && <NowLine time={time} />}
              {current.map((r, i) => (
                <Fragment key={`${tab}-${r.event.id}`}>
                  <Row r={r} i={i} />
                  {showNow && i === lastLive && <NowLine time={time} />}
                </Fragment>
              ))}
              {later.length > 0 && (
                <>
                  <li className="dep-divider">
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

        <footer className="dep-foot">
          {pageCount > 1 ? (
            <div className="dep-pager">
              <button type="button" className="icon-btn" aria-label="Previous page" onClick={() => setPage((p) => (p - 1 + pageCount) % pageCount)}>
                <CaretLeft size={16} weight="bold" />
              </button>
              <span aria-live="polite">
                <span className="sr-only">Page </span>
                {(page % pageCount) + 1}/{pageCount}
              </span>
              <button type="button" className="icon-btn" aria-label="Next page" onClick={() => setPage((p) => (p + 1) % pageCount)}>
                <CaretRight size={16} weight="bold" />
              </button>
            </div>
          ) : (
            <span />
          )}
          <Link href={`/explore?when=${tab}`} className="dep-all">
            {settled && rows.length > 0 ? `All ${rows.length} ${active.word}` : `Everything ${active.word}`}
            <ArrowRight size={16} weight="bold" aria-hidden="true" />
          </Link>
        </footer>
      </div>
    </section>
  );
}

function Row({ r, i }: { r: BoardRow; i: number }) {
  const cat = getCategoryColor(r.event.category).color;
  // A picture that won't load gives way to the category's icon.
  const [broken, setBroken] = useState(false);
  return (
    <li className={`dep-row is-${r.tone}`} data-vt-card style={{ "--cat": cat, "--i": i } as React.CSSProperties}>
      <TransitionLink href={`/events/${r.event.id}`} kind="event" preview={r.event} className="dep-link">
        <span className="dep-when">
          {r.day && <span className="dep-day">{r.day}</span>}
          <FlapText
            text={r.time === "ALL DAY" ? "--:--" : r.time}
            label={r.time === "ALL DAY" ? "Time TBA" : r.time}
            length={5}
            delay={Math.min(i, 6) * 40}
            className="dep-flap"
          />
        </span>
        <span className="dep-thumb" data-vt-media>
          {r.event.image_url && !broken ? (
            <img
              src={sized(r.event.image_url, 56)!}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
            />
          ) : (
            <CategoryIcon category={r.event.category} size={20} />
          )}
        </span>
        <span className="dep-what">
          <span className="dep-title">{r.title}</span>
          <span className="dep-venue">
            <span className="sr-only">, at </span>
            {r.area || "Venue on listing"}
          </span>
        </span>
        <span className="dep-status">
          <span className="sr-only">, </span>
          {r.tone === "live" && <span className="live-dot" aria-hidden="true" />}
          {r.status}
        </span>
      </TransitionLink>
    </li>
  );
}

function NowLine({ time }: { time: string }) {
  return (
    <li className="dep-now" aria-label={`Now, ${time}`}>
      <span className="dep-now-tag">Now</span>
      <span className="dep-now-rule" aria-hidden="true" />
    </li>
  );
}
