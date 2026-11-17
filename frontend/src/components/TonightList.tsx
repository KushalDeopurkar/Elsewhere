"use client";

/**
 * Editorial list of what's coming up soonest, in big type. On desktop the
 * event picture floats beside the pointer as you move down the rows (see
 * CursorLayer); on touch screens each row shows a small thumbnail instead.
 */
import { useMemo } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import TransitionLink from "./TransitionLink";
import EventImage from "./EventImage";
import type { Event } from "@/lib/types";
import { formatWhen } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import { CATEGORIES } from "@/lib/types";

const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

export default function TonightList({ events, city }: { events: Event[]; city: string }) {
  // `events` is already upcoming-only (ended events are filtered upstream).
  const rows = useMemo(
    () =>
      [...events]
        .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
        .slice(0, 7),
    [events],
  );
  if (rows.length < 3) return null;
  return (
    <section className="shell sec tonight" aria-labelledby="tonight-title">
      <p className="tonight-kicker">Coming up first</p>
      <h2 id="tonight-title" className="tonight-title">
        Next up in {city}
      </h2>
      <ol className="tonight-list">
        {rows.map((e, i) => (
          <li key={e.id}>
            <TransitionLink
              href={`/events/${e.id}`}
              preview={e}
              className="tonight-row"
              data-reveal-img={e.image_url ?? undefined}
              data-cursor="Open"
              prefetch={false}
            >
              <span className="tonight-n" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="tonight-thumb">
                <EventImage src={e.image_url} category={e.category} ratio="1 / 1" />
              </span>
              <span className="tonight-main">
                <span className="tonight-name">{e.title}</span>
                <span className="tonight-meta">
                  {CAT[e.category] ?? e.category}
                  {e.location_name ? ` · ${e.location_name}` : ""}
                </span>
              </span>
              <span className="tonight-when">{formatWhen(e.start_time)}</span>
              <span className="tonight-price">{priceBadge(e)}</span>
              <ArrowUpRight className="tonight-arrow" size={22} weight="bold" aria-hidden="true" />
            </TransitionLink>
          </li>
        ))}
      </ol>
    </section>
  );
}
