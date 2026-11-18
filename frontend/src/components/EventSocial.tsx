"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle, Star, ListPlus, Plus, Check } from "@phosphor-icons/react/ssr";
import Avatar from "./Avatar";
import type { Event } from "@/lib/types";
import { openSignIn, socialConfigured, useAuth } from "@/lib/auth";
import { isRealEvent } from "@/lib/supabase";
import {
  createList,
  eventCounts,
  friendsAtEvent,
  listIdsContaining,
  listsOf,
  setInList,
  type List,
  type PersonLite,
  type Status,
} from "@/lib/social";
import { recordSignal } from "@/lib/taste";
import { useMyStatus } from "@/lib/going";

/**
 * Going / Interested, how many people are, which of your friends are, and
 * "Add to list". Hidden for sample events and when sign-in isn't set up.
 */
export default function EventSocial({ event }: { event: Event }) {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [counts, setCounts] = useState<{ going: number; interested: number } | null>(null);
  const [friends, setFriends] = useState<(PersonLite & { status: Status })[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = socialConfigured && isRealEvent(event);
  const [{ status }, setMine] = useMyStatus(event.id, enabled);

  const load = useCallback(async () => {
    try {
      const [c, fr] = await Promise.all([eventCounts(event.id), uid ? friendsAtEvent(event.id) : Promise.resolve([])]);
      setCounts(c);
      setFriends(fr);
    } catch {
      setCounts(null);
    }
  }, [event.id, uid]);

  // Load, and refresh the counts whenever your own status changes (from
  // here or from the sticky action bar).
  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => void load(), status === undefined ? 0 : 400);
    return () => window.clearTimeout(t);
  }, [enabled, load, status]);

  if (!enabled) return null;

  const choose = async (next: Status) => {
    if (!uid) return openSignIn(next === "going" ? "to say you're going" : "to mark this as interested");
    const value = status === next ? null : next;
    const prev = status;
    setBusy(true);
    setError(null);
    // Optimistic counts.
    setCounts((c) => {
      if (!c) return c;
      const n = { ...c };
      if (prev) n[prev] = Math.max(0, n[prev] - 1);
      if (value) n[value] += 1;
      return n;
    });
    try {
      await setMine(value);
      if (value) {
        recordSignal(event, "save");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
      void load();
    } finally {
      setBusy(false);
    }
  };

  const going = friends.filter((f) => f.status === "going");
  const interested = friends.filter((f) => f.status === "interested");
  const total = (counts?.going ?? 0) + (counts?.interested ?? 0);

  return (
    <section className="esocial" aria-label="Who's going">
      <div className="esocial-row">
        <div className="esocial-choice" role="group" aria-label="Your plans for this event">
          <button type="button" className={`esocial-btn${status === "going" ? " is-on" : ""}`} aria-pressed={status === "going"} disabled={busy} onClick={() => choose("going")}>
            <CheckCircle size={18} weight={status === "going" ? "fill" : "bold"} aria-hidden="true" /> Going
          </button>
          <button
            type="button"
            className={`esocial-btn is-alt${status === "interested" ? " is-on" : ""}`}
            aria-pressed={status === "interested"}
            disabled={busy}
            onClick={() => choose("interested")}
          >
            <Star size={18} weight={status === "interested" ? "fill" : "bold"} aria-hidden="true" /> Interested
          </button>
        </div>
        <AddToList event={event} />
      </div>
      {error && (
        <p className="esocial-err" role="alert">
          {error}
        </p>
      )}
      {(friends.length > 0 || total > 0) && (
        <div className="esocial-who">
          {friends.length > 0 && (
            <span className="esocial-faces" aria-hidden="true">
              {friends.slice(0, 5).map((f) => (
                <Avatar key={f.user_id} src={f.avatar_url} name={f.display_name || f.username} size={28} />
              ))}
            </span>
          )}
          <p>
            {friends.length > 0 ? (
              <>
                {going.length > 0 && <FriendNames people={going} verb="going" />}
                {going.length > 0 && interested.length > 0 && " · "}
                {interested.length > 0 && <FriendNames people={interested} verb="interested" />}
              </>
            ) : (
              <>
                {counts?.going ? `${counts.going} going` : ""}
                {counts?.going && counts?.interested ? " · " : ""}
                {counts?.interested ? `${counts.interested} interested` : ""}
                {" on Elsewhere"}
              </>
            )}
          </p>
        </div>
      )}
      {!uid && total === 0 && <p className="esocial-hint">Mark it to let your friends know.</p>}
    </section>
  );
}

function FriendNames({ people, verb }: { people: PersonLite[]; verb: string }) {
  const first = people.slice(0, 2);
  const rest = people.length - first.length;
  return (
    <>
      {first.map((p, i) => (
        <span key={p.user_id}>
          {i > 0 && (rest > 0 || i < first.length - 1 ? ", " : " and ")}
          <Link href={`/u/${p.username}`} className="esocial-name">
            {(p.display_name || p.username).split(" ")[0]}
          </Link>
        </span>
      ))}
      {rest > 0 && ` and ${rest} more`} {people.length === 1 ? "is" : "are"} {verb}
    </>
  );
}

function AddToList({ event }: { event: Event }) {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<List[] | null>(null);
  const [inLists, setInLists] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !uid) return;
    let live = true;
    void Promise.all([listsOf(uid), listIdsContaining(event.id)])
      .then(([l, ids]) => {
        if (!live) return;
        setLists(l);
        setInLists(new Set(ids));
      })
      .catch(() => live && setErr("Couldn't load your lists."));
    const onDoc = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      live = false;
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, uid, event.id]);

  const toggle = async (id: string) => {
    const on = !inLists.has(id);
    setInLists((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    try {
      await setInList(id, event.id, on);
    } catch {
      setErr("Couldn't update that list.");
    }
  };

  return (
    <div className="addlist" ref={wrap}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => (uid ? setOpen((o) => !o) : openSignIn("to make lists"))}
      >
        <ListPlus size={17} weight="bold" aria-hidden="true" /> Add to list
      </button>
      {open && (
        <div className="addlist-pop">
          <p className="addlist-title">Your lists</p>
          {lists === null ? (
            <p className="muted">Loading…</p>
          ) : (
            <ul>
              {lists.map((l) => (
                <li key={l.id}>
                  <button type="button" role="checkbox" aria-checked={inLists.has(l.id)} onClick={() => toggle(l.id)}>
                    <span className={`addlist-box${inLists.has(l.id) ? " is-on" : ""}`} aria-hidden="true">
                      {inLists.has(l.id) && <Check size={13} weight="bold" />}
                    </span>
                    {l.title}
                  </button>
                </li>
              ))}
              {lists.length === 0 && <li className="muted">No lists yet.</li>}
            </ul>
          )}
          <form
            className="addlist-new"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!title.trim()) return;
              try {
                const l = await createList(title);
                await setInList(l.id, event.id, true);
                setLists((x) => [l, ...(x ?? [])]);
                setInLists((s) => new Set(s).add(l.id));
                setTitle("");
              } catch (e2) {
                setErr(e2 instanceof Error ? e2.message : "Couldn't create the list.");
              }
            }}
          >
            <label className="sr-only" htmlFor="addlist-name">New list name</label>
            <input id="addlist-name" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="New list, e.g. Weekend ideas" />
            <button type="submit" className="icon-btn" aria-label="Create list">
              <Plus size={16} weight="bold" />
            </button>
          </form>
          {err && <p className="esocial-err" role="alert">{err}</p>}
        </div>
      )}
    </div>
  );
}
