"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getEvent } from "@/lib/api";
import { Event } from "@/lib/types";
import { useSavedEvents } from "@/lib/savedEvents";
import EventGrid, { GridSkeleton } from "./EventGrid";
import SectionHead from "./SectionHead";

/**
 * Saved events.
 *
 * Only ids are stored locally, so the details are re-fetched here — a saved
 * event can never display stale information. Ids that no longer resolve are
 * dropped from the view rather than rendered as broken cards.
 */
export default function SavedView() {
  const { savedIds, ready } = useSavedEvents();
  // Tagged with the id list it answers, so "loading" is derived rather than
  // set synchronously inside the effect.
  const [settled, setSettled] = useState<{ tag: string; events: Event[] } | null>(null);

  const tag = savedIds.join(",");
  const current = settled?.tag === tag ? settled : null;
  const events = current?.events ?? [];
  const loading = ready && current === null;

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    Promise.all(savedIds.map((id) => getEvent(id).catch(() => null))).then(
      (results) => {
        if (cancelled) return;
        // Preserve the saved order (most recently saved first); ids that no
        // longer resolve are dropped rather than shown as broken cards.
        setSettled({ tag, events: results.filter((e): e is Event => e !== null) });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [tag, savedIds, ready]);

  return (
    <div className="shell" style={{ paddingTop: "clamp(2rem, 5vw, 3.5rem)" }}>
      <SectionHead
        index={1}
        title="Saved events"
        basis="Stored in this browser only — not synced to an account"
      />

      {!ready || loading ? (
        <GridSkeleton count={4} />
      ) : events.length === 0 ? (
        <div className="panel">
          <p className="panel-title">Nothing saved yet</p>
          <p className="panel-body">
            Use the bookmark button on any event to keep it here. Saved events
            live in this browser, so they won&rsquo;t follow you to another
            device.
          </p>
          <div className="panel-actions">
            <Link href="/" className="button button-primary">
              Start discovering
            </Link>
          </div>
        </div>
      ) : (
        <EventGrid events={events} />
      )}
    </div>
  );
}
