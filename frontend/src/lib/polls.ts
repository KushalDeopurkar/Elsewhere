"use client";

/**
 * "Who's free?" polls (migration 010). A signed-in person picks 2-3 events
 * and shares /poll/<id>; anyone with the link votes with just a name; the
 * creator locks in the winner. Everything goes through database functions,
 * which do the checking; this file only wraps them.
 */
import { createStore } from "./clientStore";
import { supabase } from "./supabase";

export interface PollVote {
  name: string;
  avatar_url: string | null;
  username: string | null;
  event_id: string;
}

export interface Poll {
  id: string;
  title: string;
  event_ids: string[];
  winner: string | null;
  created_at: string;
  is_mine: boolean;
  creator: { username: string; display_name: string | null; avatar_url: string | null } | null;
  /** The event the current voter picked, if any. */
  mine: string | null;
  votes: PollVote[];
}

export const POLL_MIN = 2;
export const POLL_MAX = 3;

// A guest's voting identity: a random key (so they can change their vote)
// and the name they gave. Kept in this browser only.
interface Voter {
  key: string;
  name: string;
}
const voterStore = createStore<Voter | null>("ee.voter.v1", null);

function randomKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function guestVoter(): Voter {
  const v = voterStore.read();
  if (v && typeof v.key === "string" && v.key.length >= 20) return { key: v.key, name: typeof v.name === "string" ? v.name : "" };
  const fresh = { key: randomKey(), name: "" };
  voterStore.write(fresh);
  return fresh;
}

/** The guest's saved name, read reactively. */
export function useGuestName(): string {
  const v = voterStore.useValue();
  return v && typeof v.name === "string" ? v.name : "";
}

export function setGuestName(name: string): void {
  voterStore.write({ ...guestVoter(), name: name.trim().slice(0, 40) });
}

function need() {
  const sb = supabase();
  if (!sb) throw new Error("Polls aren't set up on this site yet.");
  return sb;
}

function fail(e: { message: string } | null): void {
  if (e) throw new Error(e.message.replace(/^.*?:\s*/, "") || "Something went wrong");
}

export async function createPoll(title: string, eventIds: string[]): Promise<string> {
  const { data, error } = await need().rpc("create_poll", { p_title: title, p_event_ids: eventIds });
  fail(error);
  return data as string;
}

export async function getPoll(id: string, signedIn: boolean): Promise<Poll | null> {
  const { data, error } = await need().rpc("get_poll", { p_id: id, p_key: signedIn ? null : guestVoter().key });
  fail(error);
  return (data as Poll | null) ?? null;
}

export async function castVote(id: string, eventId: string, signedIn: boolean): Promise<void> {
  const v = signedIn ? null : guestVoter();
  const { error } = await need().rpc("cast_vote", {
    p_id: id,
    p_event: eventId,
    p_name: v?.name ?? null,
    p_key: v?.key ?? null,
  });
  fail(error);
}

export async function lockPoll(id: string, eventId: string | null): Promise<void> {
  const { error } = await need().rpc("lock_poll", { p_id: id, p_event: eventId });
  fail(error);
}

export interface Tally {
  eventId: string;
  votes: PollVote[];
  share: number; // 0..1 of all votes
  leading: boolean;
}

/** Votes per option, in the poll's own order, with the leader(s) marked. */
export function tally(poll: Pick<Poll, "event_ids" | "votes">): Tally[] {
  const total = poll.votes.length;
  const rows = poll.event_ids.map((id) => {
    const votes = poll.votes.filter((v) => v.event_id === id);
    return { eventId: id, votes, share: total ? votes.length / total : 0, leading: false };
  });
  const top = Math.max(0, ...rows.map((r) => r.votes.length));
  if (top > 0) rows.forEach((r) => (r.leading = r.votes.length === top));
  return rows;
}

/** The single leader, or null on a tie or no votes. */
export function leader(poll: Pick<Poll, "event_ids" | "votes">): string | null {
  const lead = tally(poll).filter((t) => t.leading);
  return lead.length === 1 ? lead[0].eventId : null;
}
