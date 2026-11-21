"use client";

import Link from "next/link";
import EventImage from "./EventImage";
import { useCityEvents } from "@/hooks/useCityEvents";
import { useCity } from "@/lib/cityPref";
import { cityZone } from "@/lib/cities";
import { whenOf } from "@/lib/formatDate";
import { useNow } from "@/lib/clock";
import type { Event, EventCategory } from "@/lib/types";

const SHOWN = 4;

/** "Today 19:30", "Tmrw 11:00", "Sat 13:00": fits a narrow ticket stub. */
function shortWhen(e: Event, zone: string, now: number): string {
  const t = Date.parse(e.start_time);
  const d = (x: number) => new Date(x).toLocaleDateString("en-CA", { timeZone: zone });
  const time = new Date(t).toLocaleTimeString("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const label = now && d(t) === d(now)
    ? "Today"
    : now && d(t) === d(now + 86_400_000)
      ? "Tmrw"
      : new Date(t).toLocaleDateString("en-GB", { timeZone: zone, weekday: "short" });
  return `${label} ${time}`;
}

/**
 * The page header's right side: the next few real events in the city (with
 * pictures), as small tickets you can open, and a one-line count of what's
 * on. Reads the same cached list Explore and the home page use, so it costs
 * no extra request on those pages.
 */
export default function PosterRail({ category }: { category?: EventCategory }) {
  const city = useCity();
  const pool = useCityEvents(city, { category: category ?? null, limit: 100 });
  const now = useNow(60_000);
  const zone = cityZone(city);

  if (pool.error && !pool.events.length) return null;
  const loading = !pool.events.length && pool.loading;

  const upcoming = pool.events.filter((e) => !now || Date.parse(e.end_time ?? e.start_time) >= now);
  const posters = upcoming.filter((e) => e.image_url).slice(0, SHOWN);
  if (!loading && posters.length === 0) return null;

  const day = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: zone });
  const today = now ? upcoming.filter((e) => day(Date.parse(e.start_time)) === day(now)).length : 0;
  const free = upcoming.filter((e) => e.is_free).length;
  const more = pool.more ? "+" : "";

  return (
    <aside className="prail" aria-label={`Coming up in ${city.name}`}>
      <ol className="prail-list">
        {loading
          ? Array.from({ length: SHOWN }, (_, i) => <li key={i} className="prail-item is-skel" aria-hidden="true" />)
          : posters.map((e: Event) => (
              <li key={e.id} className="prail-item">
                <Link href={`/events/${e.id}`} className="prail-link" aria-label={`${e.title}, ${whenOf(e)}`}>
                  <EventImage src={e.image_url} category={e.category} ratio="3 / 4" width={180} />
                  <span className="prail-when">{shortWhen(e, zone, now)}</span>
                </Link>
              </li>
            ))}
      </ol>
      {!loading && (
        <p className="prail-count">
          <strong>{upcoming.length}{more}</strong> coming up
          {today > 0 && (
            <>
              , <strong>{today}</strong> today
            </>
          )}
          {free > 0 && (
            <>
              , <strong>{free}</strong> free
            </>
          )}
        </p>
      )}
    </aside>
  );
}
