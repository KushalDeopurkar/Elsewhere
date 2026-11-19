"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import EventCard from "./EventCard";
import Rail from "./Rail";
import type { Event } from "@/lib/types";
import { vibeFit, type VibeId } from "@/lib/vibe";
import { sortEvents } from "@/lib/eventFilters";

/** Plans people make, not genres: each one draws on several categories. */
const COLLECTIONS: { id: VibeId; label: string; line: string; mood: VibeId }[] = [
  { id: "learn", label: "Learn something", line: "Workshops, talks, classes and hackathons", mood: "learn" },
  { id: "social", label: "Meet people", line: "Meetups, networking, clubs and community", mood: "social" },
  { id: "active", label: "Get moving", line: "Runs, matches, treks and fitness", mood: "active" },
  { id: "creative", label: "Make or watch art", line: "Exhibitions, theatre, comedy, open mics", mood: "creative" },
  { id: "chill", label: "Take it slow", line: "Brunches, walks, tastings and quiet things", mood: "chill" },
];

/**
 * Editorial collections on the home page. One tab per kind of plan; each
 * shows the soonest events that fit it. Tabs with nothing in them are left
 * out, so a collection never opens on an empty shelf.
 */
export default function Collections({ events, exclude }: { events: Event[]; exclude: ReadonlySet<string> }) {
  const sets = useMemo(
    () =>
      COLLECTIONS.map((c) => ({
        ...c,
        events: sortEvents(
          events.filter((e) => !exclude.has(e.id) && vibeFit(e, [c.id]) > 0),
          "soonest",
        ).slice(0, 12),
      })).filter((c) => c.events.length >= 2),
    [events, exclude],
  );
  const [active, setActive] = useState<VibeId | null>(null);
  const current = sets.find((s) => s.id === active) ?? sets[0];
  if (!current) return null;

  return (
    <div className="coll">
      <div className="coll-tabs" role="tablist" aria-label="Collections">
        {sets.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            id={`coll-${s.id}`}
            aria-selected={s.id === current.id}
            aria-controls="coll-panel"
            className="coll-tab"
            onClick={() => setActive(s.id)}
          >
            <span className="coll-tab-label">{s.label}</span>
            <span className="coll-tab-count">{s.events.length}</span>
          </button>
        ))}
      </div>
      <div id="coll-panel" role="tabpanel" aria-labelledby={`coll-${current.id}`} className="coll-panel">
        <p className="coll-line">
          {current.line}.{" "}
          <Link href={`/explore?mood=${current.mood}`} className="link-arrow">
            See all
          </Link>
        </p>
        <Rail label={current.label}>
          {current.events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </Rail>
      </div>
    </div>
  );
}
