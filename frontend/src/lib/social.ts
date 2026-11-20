"use client";

/**
 * Social data: profiles, follows, Going/Interested, lists. Thin wrappers over
 * Supabase; the database's row level security enforces who sees what, so
 * nothing here is a privacy boundary on its own.
 */
import type { Event } from "./types";
import type { Profile } from "./auth";
import { currentUserId } from "./auth";
import { supabase } from "./supabase";
import { decodeRows } from "./text";

export type Status = "going" | "interested";
export type Visibility = "private" | "friends" | "public";
export type Relation = "self" | "none" | "following" | "follower" | "friends";

export interface PersonLite {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface List {
  id: string;
  owner: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

const PROFILE_COLS = "id, username, display_name, avatar_url, bio, city, is_public";

function need() {
  const sb = supabase();
  if (!sb) throw new Error("Social features aren't set up.");
  return sb;
}
function must<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

type Row = Omit<Event, "distance_km" | "relevance" | "category"> & { category: string };
const toEvents = (rows: Row[] | null): Event[] =>
  decodeRows((rows ?? []).map((r) => ({ ...r, category: r.category as Event["category"], distance_km: null, relevance: null })));

export async function eventsByIds(ids: string[]): Promise<Event[]> {
  if (!ids.length) return [];
  const rows = must(await need().rpc("events_by_ids", { ids })) as Row[];
  const byId = new Map(toEvents(rows).map((e) => [e.id, e]));
  return ids.map((id) => byId.get(id)).filter((e): e is Event => Boolean(e));
}

// ---------- profiles ----------
export async function profileByUsername(username: string): Promise<Profile | null> {
  return must(await need().from("profiles").select(PROFILE_COLS).eq("username", username.toLowerCase()).maybeSingle()) as Profile | null;
}

export async function searchPeople(q: string): Promise<Profile[]> {
  const t = q.trim().replace(/[%_,()]/g, "");
  if (t.length < 2) return [];
  return must(
    await need().from("profiles").select(PROFILE_COLS).or(`username.ilike.${t.toLowerCase()}%,display_name.ilike.%${t}%`).limit(20),
  ) as Profile[];
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function updateProfile(patch: Partial<Omit<Profile, "id">>): Promise<void> {
  const uid = currentUserId();
  if (!uid) throw new Error("Sign in first.");
  const r = await need().from("profiles").update(patch).eq("id", uid);
  if (r.error) throw new Error(r.error.code === "23505" ? "That username is taken." : r.error.message);
}

export async function profileStats(id: string): Promise<{ followers: number; following: number; friends: number }> {
  const rows = must(await need().rpc("profile_stats", { p: id })) as { followers: number; following: number; friends: number }[];
  const r = rows[0] ?? { followers: 0, following: 0, friends: 0 };
  return { followers: Number(r.followers), following: Number(r.following), friends: Number(r.friends) };
}

// ---------- follows ----------
export async function relationTo(other: string): Promise<Relation> {
  const me = currentUserId();
  if (!me) return "none";
  if (me === other) return "self";
  const rows = must(
    await need().from("follows").select("follower, followee").or(`and(follower.eq.${me},followee.eq.${other}),and(follower.eq.${other},followee.eq.${me})`),
  ) as { follower: string; followee: string }[];
  const out = rows.some((r) => r.follower === me);
  const inn = rows.some((r) => r.follower === other);
  return out && inn ? "friends" : out ? "following" : inn ? "follower" : "none";
}

export async function follow(other: string): Promise<void> {
  const me = currentUserId();
  if (!me) throw new Error("Sign in first.");
  const r = await need().from("follows").insert({ follower: me, followee: other });
  if (r.error && r.error.code !== "23505") throw new Error(r.error.message);
}

export async function unfollow(other: string): Promise<void> {
  const me = currentUserId();
  if (!me) return;
  must(await need().from("follows").delete().eq("follower", me).eq("followee", other));
}

/** People this person follows / who follow them, with profile details. */
export async function connections(id: string, which: "followers" | "following"): Promise<Profile[]> {
  const col = which === "followers" ? "followee" : "follower";
  const other = which === "followers" ? "follower" : "followee";
  const rows = must(await need().from("follows").select(other).eq(col, id).limit(200)) as Record<string, string>[];
  const ids = rows.map((r) => r[other]);
  if (!ids.length) return [];
  return must(await need().from("profiles").select(PROFILE_COLS).in("id", ids)) as Profile[];
}

// ---------- going / interested ----------
export async function myStatus(eventId: string): Promise<Status | null> {
  const me = currentUserId();
  if (!me) return null;
  const r = must(await need().from("attendance").select("status").eq("user_id", me).eq("event_id", eventId).maybeSingle()) as { status: Status } | null;
  return r?.status ?? null;
}

export async function setStatus(eventId: string, status: Status | null): Promise<void> {
  const me = currentUserId();
  if (!me) throw new Error("Sign in first.");
  const sb = need();
  if (status === null) must(await sb.from("attendance").delete().eq("user_id", me).eq("event_id", eventId));
  else must(await sb.from("attendance").upsert({ user_id: me, event_id: eventId, status }, { onConflict: "user_id,event_id" }));
}

export async function eventCounts(eventId: string): Promise<{ going: number; interested: number }> {
  const rows = must(await need().rpc("event_counts", { e: eventId })) as { going: number; interested: number }[];
  return { going: Number(rows[0]?.going ?? 0), interested: Number(rows[0]?.interested ?? 0) };
}

export async function friendsAtEvent(eventId: string): Promise<(PersonLite & { status: Status })[]> {
  return must(await need().rpc("friends_at_event", { e: eventId })) as (PersonLite & { status: Status })[];
}

export interface FriendPlan extends PersonLite {
  event_id: string;
  status: Status;
  start_time: string;
}
export async function friendsUpcoming(): Promise<FriendPlan[]> {
  return must(await need().rpc("friends_upcoming", { max_rows: 60 })) as FriendPlan[];
}

/** Upcoming events someone is going to or interested in (as far as RLS lets the viewer see). */
export async function plansOf(userId: string): Promise<{ event: Event; status: Status }[]> {
  const rows = must(await need().from("attendance").select("event_id, status").eq("user_id", userId).order("updated_at", { ascending: false }).limit(100)) as {
    event_id: string;
    status: Status;
  }[];
  const events = await eventsByIds(rows.map((r) => r.event_id));
  const status = new Map(rows.map((r) => [r.event_id, r.status]));
  const now = Date.now();
  return events
    .filter((e) => (e.end_time ? Date.parse(e.end_time) : Date.parse(e.start_time) + 3 * 3_600_000) > now)
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
    .map((e) => ({ event: e, status: status.get(e.id)! }));
}

// ---------- lists ----------
export async function listsOf(userId: string): Promise<List[]> {
  return must(await need().from("lists").select("*").eq("owner", userId).order("updated_at", { ascending: false })) as List[];
}

export async function getList(id: string): Promise<{ list: List; owner: Profile | null; events: Event[] } | null> {
  const sb = need();
  const list = must(await sb.from("lists").select("*").eq("id", id).maybeSingle()) as List | null;
  if (!list) return null;
  const [owner, items] = await Promise.all([
    sb.from("profiles").select(PROFILE_COLS).eq("id", list.owner).maybeSingle(),
    sb.from("list_items").select("event_id").eq("list_id", id).order("added_at", { ascending: true }),
  ]);
  const events = await eventsByIds(((items.data ?? []) as { event_id: string }[]).map((r) => r.event_id));
  return { list, owner: (owner.data as Profile | null) ?? null, events };
}

export async function createList(title: string, visibility: Visibility = "friends", description?: string): Promise<List> {
  const me = currentUserId();
  if (!me) throw new Error("Sign in first.");
  const clean = title.trim().replace(/\s+/g, " ").slice(0, 60);
  // One list per name (case-insensitive), so "Weekend" and "weekend" can't both exist.
  const mine = must(await need().from("lists").select("title").eq("owner", me)) as { title: string }[];
  if (mine.some((l) => l.title.trim().toLowerCase() === clean.toLowerCase())) {
    throw new Error(`You already have a list called "${clean}".`);
  }
  return must(await need().from("lists").insert({ owner: me, title: clean, visibility, description: description?.trim() || null }).select("*").single()) as List;
}

export async function updateList(id: string, patch: Partial<Pick<List, "title" | "description" | "visibility">>): Promise<void> {
  must(await need().from("lists").update(patch).eq("id", id));
}

export async function deleteList(id: string): Promise<void> {
  must(await need().from("lists").delete().eq("id", id));
}

export async function listIdsContaining(eventId: string): Promise<string[]> {
  const me = currentUserId();
  if (!me) return [];
  const rows = must(await need().from("list_items").select("list_id, lists!inner(owner)").eq("event_id", eventId).eq("lists.owner", me)) as { list_id: string }[];
  return rows.map((r) => r.list_id);
}

export async function setInList(listId: string, eventId: string, on: boolean): Promise<void> {
  const sb = need();
  if (on) {
    const r = await sb.from("list_items").insert({ list_id: listId, event_id: eventId });
    if (r.error && r.error.code !== "23505") throw new Error(r.error.message);
  } else {
    must(await sb.from("list_items").delete().eq("list_id", listId).eq("event_id", eventId));
  }
}
