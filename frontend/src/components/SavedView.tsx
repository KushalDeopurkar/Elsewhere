"use client";

import { track } from "@/lib/track";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookmarkSimple, Trash, Path, UsersThree, CheckCircle, Circle, X } from "@phosphor-icons/react/ssr";
import EventCard from "./EventCard";
import ShareCard from "./ShareCard";
import RemindersCard from "./RemindersCard";
import { EmptyState, SectionHeader } from "./Section";
import { removeSaved, useSaved } from "@/lib/saved";
import { openSignIn, socialConfigured, useAuth } from "@/lib/auth";
import { isRealEvent } from "@/lib/supabase";
import { createPoll, POLL_MAX, POLL_MIN } from "@/lib/polls";

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

  // "Ask friends": pick 2-3 upcoming saves and turn them into a poll.
  const { session } = useAuth();
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [creating, setCreating] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const pollable = upcoming.filter((s) => isRealEvent(s.event));
  const canPoll = socialConfigured && pollable.length >= POLL_MIN;
  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= POLL_MAX ? c : [...c, id]));
  const startPoll = async () => {
    if (!session) {
      openSignIn("to start a poll");
      return;
    }
    setCreating(true);
    setPollError(null);
    try {
      const id = await createPoll(question.trim() || "Which one?", chosen);
      track("poll_created", { options: chosen.length });
      router.push(`/poll/${id}?new=1`);
    } catch (e) {
      setPollError(e instanceof Error ? e.message : "Couldn't start the poll.");
      setCreating(false);
    }
  };

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
      <section className="sec-tight">
        <SectionHeader title={`Upcoming (${upcoming.length})`} />
        {upcoming.length > 0 && (
          <div className="saved-share">
            <Link href="/plan-my-day" className="btn btn-primary">
              <Path size={16} weight="bold" aria-hidden="true" /> Plan my day
            </Link>
            {canPoll && (
              <button
                type="button"
                className="btn btn-ghost"
                aria-pressed={picking}
                onClick={() => {
                  setPicking((p) => !p);
                  setChosen([]);
                }}
              >
                <UsersThree size={16} weight="bold" aria-hidden="true" /> {picking ? "Cancel poll" : "Ask friends"}
              </button>
            )}
            <ShareCard ids={upcoming.map((s) => s.event.id)} title="On my list" kicker="Coming up" label="Share my list as a card" />
          </div>
        )}
        {upcoming.length > 0 && !picking && (
          <RemindersCard events={upcoming.map((s) => s.event).filter(isRealEvent)} />
        )}
        {picking && (
          <p className="poll-hint" role="status">
            Pick {POLL_MIN} or {POLL_MAX} events. Friends vote on the link, no account needed.
          </p>
        )}
        {upcoming.length === 0 ? (
          <p className="muted">None of your saved events are coming up.</p>
        ) : (
          <div className="xgrid">
            {upcoming.map(({ event }) => {
              const on = chosen.includes(event.id);
              const can = isRealEvent(event);
              return (
                <div key={event.id} className={`saved-item${picking ? " is-picking" : ""}${on ? " is-chosen" : ""}`}>
                  <EventCard event={event} />
                  {picking ? (
                    <button
                      type="button"
                      className="saved-pick"
                      aria-pressed={on}
                      disabled={!can || (!on && chosen.length >= POLL_MAX)}
                      onClick={() => toggle(event.id)}
                    >
                      {on ? <CheckCircle size={18} weight="fill" aria-hidden="true" /> : <Circle size={18} weight="bold" aria-hidden="true" />}
                      {!can ? "Can't poll a sample" : on ? "In the poll" : "Add to poll"}
                    </button>
                  ) : (
                    <button type="button" className="saved-remove" onClick={() => removeSaved(event.id)} aria-label={`Remove ${event.title} from saved`}>
                      <Trash size={14} weight="bold" aria-hidden="true" /> Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {picking && (
        <div className="poll-tray" role="region" aria-label="New poll">
          <button
            type="button"
            className="poll-tray-x"
            aria-label="Cancel poll"
            onClick={() => {
              setPicking(false);
              setChosen([]);
            }}
          >
            <X size={16} weight="bold" />
          </button>
          <label className="poll-tray-q">
            <span className="sr-only">Question</span>
            <input value={question} maxLength={80} placeholder="Which one? (Fri night)" onChange={(e) => setQuestion(e.target.value)} />
          </label>
          <span className="poll-tray-n mono">
            {chosen.length}/{POLL_MAX}
          </span>
          <button type="button" className="btn btn-primary" disabled={chosen.length < POLL_MIN || creating} onClick={startPoll}>
            {creating ? "Starting…" : "Start poll"}
          </button>
          {pollError && (
            <p className="poll-error" role="alert">
              {pollError}
            </p>
          )}
        </div>
      )}

      {past.length > 0 && (
        <section className="sec-tight">
          <SectionHeader title={`Past (${past.length})`} />
          <div className="xgrid is-past">
            {past.map(({ event }) => (
              <div key={event.id} className="saved-item">
                <EventCard event={event} />
                <button type="button" className="saved-remove" onClick={() => removeSaved(event.id)} aria-label={`Remove ${event.title} from saved`}>
                  <Trash size={14} weight="bold" aria-hidden="true" /> Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
