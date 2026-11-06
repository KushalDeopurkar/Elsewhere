"use client";

import { useState } from "react";
import Link from "next/link";
import { BookmarkSimple, Trash, Info } from "@phosphor-icons/react/ssr";
import EventCard from "./EventCard";
import { EmptyState, SectionHeader } from "./Section";
import { removeSaved, useSaved } from "@/lib/saved";

export default function SavedView() {
  const saved = useSaved();
  // Fixed at mount: a list that reshuffles while you read it is worse.
  const [now] = useState(() => Date.now());
  const isPast = (iso: string, end: string | null) =>
    (end ? Date.parse(end) : Date.parse(iso) + 3 * 3_600_000) < now;
  const upcoming = saved
    .filter((s) => !isPast(s.event.start_time, s.event.end_time))
    .sort((a, b) => Date.parse(a.event.start_time) - Date.parse(b.event.start_time));
  const past = saved.filter((s) => isPast(s.event.start_time, s.event.end_time));

  if (saved.length === 0) {
    return (
      <EmptyState
        icon={<BookmarkSimple size={32} weight="duotone" />}
        title="Nothing saved yet"
        body="Tap the bookmark on any event to keep it here."
      >
        <Link href="/explore" className="btn btn-primary">Explore events</Link>
      </EmptyState>
    );
  }

  return (
    <>
      <p className="notice notice-quiet">
        <Info size={15} weight="fill" /> Saved on this device. Sign-in to sync across devices isn&apos;t available yet.
      </p>

      <section className="sec-tight">
        <SectionHeader title={`Upcoming (${upcoming.length})`} />
        {upcoming.length === 0 ? (
          <p className="muted">None of your saved events are coming up.</p>
        ) : (
          <div className="xgrid">
            {upcoming.map(({ event }) => (
              <div key={event.id} className="saved-item">
                <EventCard event={event} />
                <button type="button" className="saved-remove" onClick={() => removeSaved(event.id)}>
                  <Trash size={14} weight="bold" /> Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="sec-tight">
          <SectionHeader title={`Past (${past.length})`} />
          <div className="xgrid is-past">
            {past.map(({ event }) => (
              <div key={event.id} className="saved-item">
                <EventCard event={event} />
                <button type="button" className="saved-remove" onClick={() => removeSaved(event.id)}>
                  <Trash size={14} weight="bold" /> Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
