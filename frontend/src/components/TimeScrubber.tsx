"use client";

import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { Pause, Play, X, ClockCountdown } from "@phosphor-icons/react";
import type { Event } from "@/lib/types";
import { HOUR, WEEK_HOURS, busyness, momentLabel } from "@/lib/timeline";

const BUCKET = 3;
const STEP_MS = 320;

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

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setHour((h) => {
        if (h >= WEEK_HOURS - 1) {
          setPlaying(false);
          return h;
        }
        return h + 1;
      });
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, setHour, setPlaying]);

  if (!on) {
    return (
      <button
        type="button"
        className="tl-open"
        onClick={() => {
          setOn(true);
          setHour(0);
          setPlaying(true);
        }}
      >
        <ClockCountdown size={16} weight="bold" aria-hidden="true" /> Play the week
      </button>
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
        <button
          type="button"
          className="tl-play"
          onClick={() => {
            if (!playing && hour >= WEEK_HOURS - 1) setHour(0);
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
