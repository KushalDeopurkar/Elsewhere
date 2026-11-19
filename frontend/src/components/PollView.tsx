"use client";

import { track } from "@/lib/track";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle, Crown, LinkSimple, ShareNetwork, Ticket } from "@phosphor-icons/react/ssr";
import Avatar from "./Avatar";
import EventImage from "./EventImage";
import { CardSkeleton, EmptyState } from "./Section";
import { socialConfigured, useAuth, openSignIn } from "@/lib/auth";
import { eventsByIds } from "@/lib/social";
import { castVote, getPoll, leader, lockPoll, setGuestName, tally, useGuestName, type Poll } from "@/lib/polls";
import { useMyStatus } from "@/lib/going";
import { whenOf } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import { getCategoryColor } from "@/lib/categoryColors";
import type { Event } from "@/lib/types";

const REFRESH_MS = 8000;

/**
 * One poll: the 2-3 events side by side, live vote counts with who picked
 * what, and for the person who started it, a way to lock in the winner.
 * Anyone with the link can vote with just a name.
 */
export default function PollView({ id, fresh = false }: { id: string; fresh?: boolean }) {
  const { ready, session } = useAuth();
  const signedIn = Boolean(session);
  const [poll, setPoll] = useState<Poll | null | undefined>(undefined);
  const [events, setEvents] = useState<Map<string, Event>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const guestName = useGuestName();
  const [nameDraft, setNameDraft] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const fetched = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const p = await getPoll(id, signedIn);
      setPoll(p);
      if (p && !p.event_ids.every((e) => fetched.current.has(e))) {
        p.event_ids.forEach((e) => fetched.current.add(e));
        const list = await eventsByIds(p.event_ids);
        setEvents(new Map(list.map((e) => [e.id, e])));
      }
    } catch {
      setPoll((prev) => (prev === undefined ? null : prev));
    }
  }, [id, signedIn]);

  useEffect(() => {
    if (!ready || !socialConfigured) return;
    const first = window.setTimeout(load, 0);
    // Keep counts fresh while the page is open and visible.
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(tick);
    };
  }, [ready, load]);

  if (!socialConfigured) return <EmptyState icon={null} title="Polls aren't switched on yet" body="" />;
  if (poll === undefined) {
    return (
      <div className="poll" aria-busy="true">
        <div className="poll-opts">{[0, 1, 2].map((i) => <CardSkeleton key={i} />)}</div>
      </div>
    );
  }
  if (poll === null) {
    return (
      <EmptyState icon={null} title="This poll doesn't exist" body="The link may be mistyped, or the poll was deleted.">
        <Link href="/" className="btn btn-primary">Back home</Link>
      </EmptyState>
    );
  }

  const rows = tally(poll);
  const total = poll.votes.length;
  const lead = leader(poll);
  const decided = poll.winner;
  const who = poll.creator?.display_name || poll.creator?.username || "Someone";
  const needsName = !signedIn && !guestName;

  const vote = async (eventId: string) => {
    setError(null);
    if (needsName) {
      const n = nameDraft.trim();
      if (!n) {
        setError("Add your name first, so friends know who voted.");
        nameRef.current?.focus();
        return;
      }
      setGuestName(n);
    }
    setBusy(eventId);
    // Show the vote straight away; the next refresh confirms it.
    setPoll((p) => {
      if (!p) return p;
      const me = { name: signedIn ? "You" : nameDraft.trim() || guestName || "You", avatar_url: null, username: null, event_id: eventId };
      const others = p.mine ? removeOne(p.votes, p.mine, me.name) : p.votes;
      return { ...p, mine: eventId, votes: [...others, me] };
    });
    try {
      await castVote(poll.id, eventId, signedIn);
      track("poll_vote", { signed_in: signedIn });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your vote.");
    } finally {
      setBusy(null);
      void load();
    }
  };

  const lock = async (eventId: string | null) => {
    setError(null);
    setBusy("lock");
    try {
      await lockPoll(poll.id, eventId);
      if (eventId) track("poll_decided", { votes: poll.votes.length });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update the poll.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="poll">
      <header className="poll-head">
        <p className="poll-asker">
          <Avatar src={poll.creator?.avatar_url} name={who} size={28} />
          <span>
            <strong>{poll.is_mine ? "You" : who}</strong> {poll.is_mine ? "asked" : "asks"}
          </span>
        </p>
        <h1 className="poll-title">{poll.title}</h1>
        <p className="poll-sub">
          {decided
            ? "Decided. See you there."
            : total === 0
              ? "No votes yet. Pick the one you'd go to."
              : `${total} ${total === 1 ? "vote" : "votes"} so far${lead ? "" : ", it's a tie"}.`}
        </p>
        {(poll.is_mine || fresh) && !decided && <ShareBar title={poll.title} highlight={fresh} />}
      </header>

      {decided && events.get(decided) && <Decided event={events.get(decided)!} signedIn={signedIn} />}

      {!decided && needsName && (
        <label className="poll-name">
          <span>Your name</span>
          <input
            ref={nameRef}
            value={nameDraft}
            maxLength={40}
            autoComplete="given-name"
            placeholder="So friends know who voted"
            onChange={(e) => setNameDraft(e.target.value)}
          />
          <button type="button" className="poll-name-alt" onClick={() => openSignIn("to vote with your profile")}>
            or sign in
          </button>
        </label>
      )}

      {error && (
        <p className="poll-error" role="alert">
          {error}
        </p>
      )}

      <ol className="poll-opts">
        {rows.map((r, i) => {
          const e = events.get(r.eventId);
          const isMine = poll.mine === r.eventId;
          const isWinner = decided === r.eventId;
          const hue = e ? getCategoryColor(e.category).color : "var(--marigold)";
          return (
            <li
              key={r.eventId}
              className={`poll-opt${isMine ? " is-mine" : ""}${isWinner ? " is-winner" : ""}${decided && !isWinner ? " is-out" : ""}`}
              style={{ "--cat-hue": hue, "--share": r.share } as React.CSSProperties}
            >
              <div className="poll-opt-media">
                {e ? <EventImage src={e.image_url} category={e.category} ratio="16 / 9" width={360} /> : <div className="poll-opt-ph" />}
                <span className="poll-opt-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                {r.leading && total > 0 && !decided && (
                  <span className="poll-opt-lead"><Crown size={13} weight="fill" aria-hidden="true" /> Leading</span>
                )}
              </div>
              <div className="poll-opt-body">
                <h2 className="poll-opt-title">{e ? e.title : "Loading…"}</h2>
                {e && (
                  <p className="poll-opt-meta">
                    {whenOf(e)}
                    <br />
                    {priceBadge(e)}
                    {e.location_name ? ` · ${e.location_name}` : ""}
                  </p>
                )}
                <div className="poll-bar" aria-hidden="true">
                  <span className="poll-bar-fill" />
                </div>
                <p className="poll-count">
                  <strong>{r.votes.length}</strong> {r.votes.length === 1 ? "vote" : "votes"}
                  {r.votes.length > 0 && (
                    <span className="poll-voters">
                      {r.votes.slice(0, 5).map((v, k) => (
                        <Avatar key={`${v.name}-${k}`} src={v.avatar_url} name={v.name} size={22} />
                      ))}
                      <span className="poll-voter-names">{names(r.votes.map((v) => v.name))}</span>
                    </span>
                  )}
                </p>
                <div className="poll-actions">
                  {!decided && (
                    <button
                      type="button"
                      className={`btn ${isMine ? "btn-primary" : "btn-ghost"} poll-vote`}
                      aria-pressed={isMine}
                      disabled={busy !== null}
                      onClick={() => vote(r.eventId)}
                    >
                      {isMine ? (
                        <>
                          <CheckCircle size={17} weight="fill" aria-hidden="true" /> Your pick
                        </>
                      ) : poll.mine ? (
                        "Switch to this"
                      ) : (
                        "I'd go to this"
                      )}
                    </button>
                  )}
                  {poll.is_mine && !decided && (
                    <button type="button" className="poll-lock" disabled={busy !== null} onClick={() => lock(r.eventId)}>
                      Lock this in
                    </button>
                  )}
                  {e && (
                    <Link href={`/events/${e.id}`} className="poll-details">
                      Details <ArrowRight size={13} weight="bold" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {poll.is_mine && decided && (
        <p className="poll-reopen">
          <button type="button" className="poll-lock" disabled={busy !== null} onClick={() => lock(null)}>
            Reopen voting
          </button>
        </p>
      )}
    </div>
  );
}

function removeOne<T extends { event_id: string; name: string }>(votes: T[], eventId: string, name: string): T[] {
  const i = votes.findIndex((v) => v.event_id === eventId && (v.name === name || name === "You"));
  return i < 0 ? votes : [...votes.slice(0, i), ...votes.slice(i + 1)];
}

function names(list: string[]): string {
  if (list.length <= 2) return list.join(" and ");
  return `${list.slice(0, 2).join(", ")} and ${list.length - 2} more`;
}

function ShareBar({ title, highlight }: { title: string; highlight: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href.split("?")[0] : "";
  const share = async () => {
    const text = `${title} Vote here:`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        /* cancelled: fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* no clipboard: the link is in the address bar */
    }
  };
  return (
    <div className={`poll-share${highlight ? " is-fresh" : ""}`}>
      {highlight && <p className="poll-share-note">Your poll is ready. Send it to the group.</p>}
      <div className="poll-share-row">
        <button type="button" className="btn btn-primary" onClick={share}>
          <ShareNetwork size={17} weight="bold" aria-hidden="true" /> Send to friends
        </button>
        <a className="btn btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(`${title} Vote here: ${url}`)}`} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            } catch {
              /* ignore */
            }
          }}
        >
          {copied ? <Check size={17} weight="bold" aria-hidden="true" /> : <LinkSimple size={17} weight="bold" aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

function Decided({ event, signedIn }: { event: Event; signedIn: boolean }) {
  const [entry, setStatus] = useMyStatus(event.id, signedIn);
  const going = entry.status === "going";
  return (
    <section className="poll-decided" aria-live="polite">
      <p className="poll-decided-kicker">It&apos;s decided</p>
      <h2 className="poll-decided-title">{event.title}</h2>
      <p className="poll-decided-meta">{whenOf(event)}{event.location_name ? ` · ${event.location_name}` : ""}</p>
      <div className="poll-decided-actions">
        <button
          type="button"
          className={`btn ${going ? "btn-ghost" : "btn-primary"}`}
          aria-pressed={going}
          onClick={() => (signedIn ? void setStatus(going ? null : "going") : openSignIn("to mark yourself going"))}
        >
          <Check size={17} weight="bold" aria-hidden="true" /> {going ? "You're going" : "I'm going"}
        </button>
        {event.url && (
          <a className="btn btn-ghost" href={event.url} target="_blank" rel="noopener noreferrer">
            <Ticket size={17} weight="bold" aria-hidden="true" /> Tickets
          </a>
        )}
      </div>
    </section>
  );
}
