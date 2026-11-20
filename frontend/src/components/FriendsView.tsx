"use client";

import AccountsOff from "./AccountsOff";
import { sized } from "@/lib/imageUrl";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass, Users, UserPlus, UserCheck, LinkSimple, Check, CalendarCheck } from "@phosphor-icons/react/ssr";
import Avatar from "./Avatar";
import { EmptyState } from "./Section";
import { openSignIn, socialConfigured, useAuth, type Profile } from "@/lib/auth";
import { connections, eventsByIds, follow, friendsUpcoming, searchPeople, unfollow, type FriendPlan } from "@/lib/social";
import { whenOf } from "@/lib/formatDate";
import type { Event } from "@/lib/types";

/**
 * Find people, see who follows you, and what your friends are up to.
 * "Friends" means you follow each other.
 */
export default function FriendsView() {
  const { ready, session, profile } = useAuth();
  const me = session?.user.id ?? null;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[] | null>(null);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  // Until the lists arrive, say so instead of "Friends (0)".
  const [listsReady, setListsReady] = useState(false);
  const [plans, setPlans] = useState<{ plan: FriendPlan[]; event: Event }[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!me) return;
    let live = true;
    void (async () => {
      try {
        const [fo, fr, up] = await Promise.all([connections(me, "following"), connections(me, "followers"), friendsUpcoming()]);
        if (!live) return;
        setFollowing(fo);
        setFollowers(fr);
        setListsReady(true);
        // Group by event: "Asha and Rohan are going".
        const byEvent = new Map<string, FriendPlan[]>();
        up.forEach((p) => byEvent.set(p.event_id, [...(byEvent.get(p.event_id) ?? []), p]));
        const events = await eventsByIds([...byEvent.keys()]);
        if (live) setPlans(events.map((event) => ({ event, plan: byEvent.get(event.id)! })));
      } catch {
        if (live) {
          setPlans([]);
          setListsReady(true);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [me]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    let live = true;
    const t = window.setTimeout(() => {
      searchPeople(q)
        .then((r) => live && setResults(r.filter((p) => p.id !== me)))
        .catch(() => live && setResults([]));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [q, me]);

  const followingIds = useMemo(() => new Set(following.map((p) => p.id)), [following]);
  const followerIds = useMemo(() => new Set(followers.map((p) => p.id)), [followers]);

  if (!socialConfigured) {
    return <AccountsOff what="Friends" />;
  }
  if (!ready) return <p className="muted">Loading…</p>;
  if (!me) {
    return (
      <EmptyState icon={<Users size={30} weight="duotone" />} title="See where your friends are going" body="Sign in to follow friends, see their plans, and let them see yours.">
        <button type="button" className="btn btn-primary" onClick={() => openSignIn("to find your friends")}>Sign in</button>
      </EmptyState>
    );
  }

  const toggle = async (p: Profile) => {
    if (followingIds.has(p.id)) {
      setFollowing((l) => l.filter((x) => x.id !== p.id));
      await unfollow(p.id).catch(() => setFollowing((l) => [...l, p]));
    } else {
      setFollowing((l) => [...l, p]);
      await follow(p.id).catch(() => setFollowing((l) => l.filter((x) => x.id !== p.id)));
    }
  };

  const Row = ({ p }: { p: Profile }) => {
    const out = followingIds.has(p.id);
    const inn = followerIds.has(p.id);
    const name = p.display_name || p.username;
    return (
      <li className="fr-row">
        <Link href={`/u/${p.username}`} className="fr-who">
          <Avatar src={p.avatar_url} name={name} size={44} />
          <span>
            <strong>{name}</strong>
            <small>
              @{p.username}
              {out && inn ? " · Friends" : inn ? " · Follows you" : ""}
            </small>
          </span>
        </Link>
        <button type="button" className={`btn ${out ? "btn-ghost" : "btn-primary"} fr-btn`} aria-pressed={out} onClick={() => toggle(p)}>
          {out ? <UserCheck size={16} weight="bold" aria-hidden="true" /> : <UserPlus size={16} weight="bold" aria-hidden="true" />}
          {out ? (inn ? "Friends" : "Following") : inn ? "Follow back" : "Follow"}
        </button>
      </li>
    );
  };

  const friends = following.filter((p) => followerIds.has(p.id));
  const requests = followers.filter((p) => !followingIds.has(p.id));

  return (
    <div className="friends">
      <div className="fr-top">
        <form className="xsearch fr-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <MagnifyingGlass size={19} weight="bold" className="xsearch-icon" aria-hidden="true" />
          <input
            className="xsearch-input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (e.target.value.trim().length < 2) setResults(null);
            }}
            placeholder="Find people by name or @username"
            aria-label="Find people"
          />
        </form>
        {profile && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              const url = `${window.location.origin}/u/${profile.username}`;
              const text = `Follow me on Elsewhere to see where I'm going: ${url}`;
              try {
                if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text, url });
                else {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }
              } catch {
                /* cancelled */
              }
            }}
          >
            {copied ? <Check size={16} weight="bold" aria-hidden="true" /> : <LinkSimple size={16} weight="bold" aria-hidden="true" />}
            {copied ? "Link copied" : "Invite friends"}
          </button>
        )}
      </div>

      {results !== null && q.trim().length >= 2 && (
        <section className="fr-sec" aria-label="Search results">
          {results.length === 0 ? <p className="muted">No one found for “{q}”.</p> : <ul className="fr-list">{results.map((p) => <Row key={p.id} p={p} />)}</ul>}
        </section>
      )}

      <section className="fr-sec" aria-labelledby="fr-plans">
        <h2 id="fr-plans" className="pp-h2">Your friends&apos; plans</h2>
        {plans === null ? (
          <p className="muted">Loading…</p>
        ) : plans.length === 0 ? (
          <p className="muted">
            {friends.length ? "None of your friends has marked an upcoming event yet." : "Once you and a friend follow each other, their plans show up here."}
          </p>
        ) : (
          <ul className="fr-plans">
            {plans.map(({ event, plan }) => (
              <li key={event.id}>
                <Link href={`/events/${event.id}`} className="fr-plan">
                  {event.image_url ? <img src={sized(event.image_url, 56)!} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="fr-plan-ph" />}
                  <span className="fr-plan-text">
                    <strong>{event.title}</strong>
                    <small>{whenOf(event)}{event.location_name ? ` · ${event.location_name}` : ""}</small>
                    <span className="fr-plan-who">
                      <span className="esocial-faces" aria-hidden="true">
                        {plan.slice(0, 4).map((p) => <Avatar key={p.user_id} src={p.avatar_url} name={p.display_name || p.username} size={22} />)}
                      </span>
                      <CalendarCheck size={14} weight="bold" aria-hidden="true" />
                      {plan.map((p) => (p.display_name || p.username).split(" ")[0]).slice(0, 3).join(", ")}
                      {plan.length > 3 ? ` +${plan.length - 3}` : ""} {plan.every((p) => p.status === "interested") ? "interested" : "going"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {requests.length > 0 && (
        <section className="fr-sec" aria-labelledby="fr-req">
          <h2 id="fr-req" className="pp-h2">Follow back ({requests.length})</h2>
          <ul className="fr-list">{requests.map((p) => <Row key={p.id} p={p} />)}</ul>
        </section>
      )}

      <section className="fr-sec" aria-labelledby="fr-fr">
        <h2 id="fr-fr" className="pp-h2">Friends{listsReady ? ` (${friends.length})` : ""}</h2>
        {!listsReady ? (
          <p className="muted" aria-live="polite">Loading your friends…</p>
        ) : friends.length ? (
          <ul className="fr-list">{friends.map((p) => <Row key={p.id} p={p} />)}</ul>
        ) : (
          <p className="muted">Search for people above, or send your profile link.</p>
        )}
      </section>

      {following.length > friends.length && (
        <section className="fr-sec" aria-labelledby="fr-fo">
          <h2 id="fr-fo" className="pp-h2">Following</h2>
          <ul className="fr-list">{following.filter((p) => !followerIds.has(p.id)).map((p) => <Row key={p.id} p={p} />)}</ul>
        </section>
      )}
    </div>
  );
}
