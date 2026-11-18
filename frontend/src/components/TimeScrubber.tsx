"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import TimeDial from "./TimeDial";
import { Pause, Play, X, ClockCountdown, MoonStars } from "@phosphor-icons/react";
import type { Event } from "@/lib/types";
import { HOUR, WEEK_HOURS, busyness, momentLabel } from "@/lib/timeline";

const BUCKET = 3;
const STEP_MS = 320;
const NIGHT_STEP_MS = 750;
const IST = 5.5 * HOUR;

/**
 * Week timeline over the map. Scrubbing (or pressing play) shows only the
 * events that are on, or about to start, at that moment.
 */
export default function TimeScrubber({
  events,
  start,
  now,
  on,
  hour,
  playing,
  setOn,
  setHour,
  setPlaying,
  shown,
  live,
}: {
  events: Event[];
  start: number;
  now: number;
  on: boolean;
  hour: number;
  playing: boolean;
  setOn: (v: boolean) => void;
  setHour: Dispatch<SetStateAction<number>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  shown: number;
  live: number;
}) {
  // "Play tonight" runs slower, from the evening (or now, if it's already
  // evening) until 3 am; "Play the week" sweeps all seven days.
  const [stopAt, setStopAt] = useState(WEEK_HOURS - 1);
  const startHod = Math.floor((start + IST) / HOUR) % 24;
  const hod = (startHod + hour) % 24;
  const tonight = () => {
    const begin = startHod >= 4 && startHod < 18 ? 18 - startHod : 0;
    const begHod = (startHod + begin) % 24;
    const end = begin + ((27 - begHod + 24) % 24);
    return { begin, end: Math.min(WEEK_HOURS - 1, end) };
  };
  const bars = useMemo(() => busyness(events, start, BUCKET), [events, start]);
  const peak = Math.max(1, ...bars);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, d) => {
        const t = start + d * 24 * HOUR;
        return {
          left: (d * 24) / WEEK_HOURS,
          label: d === 0 ? "Today" : new Date(t).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short" }),
        };
      }),
    [start],
  );

  const night = stopAt < WEEK_HOURS - 1;
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setHour((h) => {
        if (h >= stopAt) {
          setPlaying(false);
          return h;
        }
        return h + 1;
      });
    }, night ? NIGHT_STEP_MS : STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, setHour, setPlaying, stopAt, night]);

  if (!on) {
    return (
      <div className="tl-opens">
        <button
          type="button"
          className="tl-open"
          onClick={() => {
            const t = tonight();
            setStopAt(t.end);
            setOn(true);
            setHour(t.begin);
            setPlaying(true);
          }}
        >
          <MoonStars size={16} weight="bold" aria-hidden="true" /> Play tonight
        </button>
        <button
          type="button"
          className="tl-open is-alt"
          onClick={() => {
            setStopAt(WEEK_HOURS - 1);
            setOn(true);
            setHour(0);
            setPlaying(true);
          }}
        >
          <ClockCountdown size={16} weight="bold" aria-hidden="true" /> Play the week
        </button>
      </div>
    );
  }

  const label = momentLabel(start + hour * HOUR, now);
  const active = Math.floor(hour / BUCKET);
  // When nothing is on, offer a jump to the hour the next event starts.
  const t = start + hour * HOUR;
  const nextStart =
    shown === 0
      ? events.reduce((m, e) => {
          const s0 = Date.parse(e.start_time);
          return s0 > t && s0 < m ? s0 : m;
        }, Infinity)
      : Infinity;
  const nextHour = Number.isFinite(nextStart) ? Math.floor((nextStart - start) / HOUR) : -1;

  return (
    <section className="tl" aria-label="Time scrubber">
      <div className="tl-head">
        <TimeDial
          hourOfDay={hod}
          label={label}
          onChange={(h) => {
            setPlaying(false);
            const delta = ((h - hod + 36) % 24) - 12;
            setHour((x) => Math.min(WEEK_HOURS - 1, Math.max(0, x + delta)));
          }}
        />
        <button
          type="button"
          className="tl-play"
          onClick={() => {
            if (!playing && hour >= stopAt) {
              setStopAt(WEEK_HOURS - 1);
              if (hour >= WEEK_HOURS - 1) setHour(0);
            }
            setPlaying((p) => !p);
          }}
          aria-label={playing ? "Pause" : "Play through the week"}
        >
          {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
        </button>
        <p className="tl-label" aria-live="polite">
          <strong>{label}</strong>
          <span>
            {shown} on{live > 0 ? ` · ` : ""}
            {live > 0 && <em>{live} live</em>}
            {nextHour > hour && nextHour < WEEK_HOURS && (
              <button
                type="button"
                className="tl-skip"
                onClick={() => {
                  setPlaying(false);
                  setHour(nextHour);
                }}
              >
                Skip to {momentLabel(start + nextHour * HOUR, now)} →
              </button>
            )}
          </span>
        </p>
        <button
          type="button"
          className="tl-close"
          onClick={() => {
            setPlaying(false);
            setOn(false);
          }}
          aria-label="Show all times"
        >
          <X size={14} weight="bold" /> Any time
        </button>
      </div>

      <div className="tl-track">
        <div className="tl-bars" aria-hidden="true">
          {bars.map((n, i) => (
            <span
              key={i}
              className={i === active ? "is-now" : i < active ? "is-past" : undefined}
              style={{ height: `${12 + (n / peak) * 88}%` }}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={WEEK_HOURS - 1}
          step={1}
          value={hour}
          onChange={(e) => {
            setPlaying(false);
            setHour(Number(e.target.value));
          }}
          aria-label="Time in the coming week"
          aria-valuetext={label}
        />
      </div>
      <div className="tl-days" aria-hidden="true">
        {days.map((d) => (
          <span key={d.label} style={{ left: `${d.left * 100}%` }}>
            {d.label}
          </span>
        ))}
      </div>
    </section>
  );
}
