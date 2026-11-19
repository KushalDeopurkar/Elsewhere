"use client";

import AccountsOff from "./AccountsOff";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, UserPlus, UserCheck, Users, Lock, Globe, LinkSimple, Check, PencilSimple, Plus } from "@phosphor-icons/react/ssr";
import Avatar from "./Avatar";
import EventCard from "./EventCard";
import CategoryIcon from "./CategoryIcon";
import { CardSkeleton, EmptyState } from "./Section";
import { openSignIn, useAuth, type Profile } from "@/lib/auth";
import { supabase, socialConfigured } from "@/lib/supabase";
import {
  createList,
  follow,
  listsOf,
  plansOf,
  profileByUsername,
  profileStats,
  relationTo,
  unfollow,
  type List,
  type Relation,
  type Status,
  type Visibility,
} from "@/lib/social";
import { EMPTY_PASSPORT, badges, mergePassports, readPassport, type Passport } from "@/lib/passport";
import { CATEGORIES, type Event } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";

type Tab = "plans" | "lists" | "passport";
const VIS_LABEL: Record<Visibility, string> = { private: "Only you", friends: "Friends", public: "Anyone with the link" };

export default function ProfileView({ username }: { username: string }) {
  const { ready, session } = useAuth();
  const me = session?.user.id ?? null;
  const router = useRouter();
  const params = useSearchParams();
  const tab = (["plans", "lists", "passport"].includes(params.get("tab") ?? "") ? params.get("tab") : "plans") as Tab;

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [stats, setStats] = useState({ followers: 0, following: 0, friends: 0 });
  const [rel, setRel] = useState<Relation>("none");
  const [plans, setPlans] = useState<{ event: Event; status: Status }[] | null>(null);
  const [lists, setLists] = useState<List[] | null>(null);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await profileByUsername(username);
      setProfile(p);
      if (!p) return;
      const [s, r, pl, ls] = await Promise.all([profileStats(p.id), relationTo(p.id), plansOf(p.id), listsOf(p.id)]);
      setStats(s);
      setRel(r);
      setPlans(pl);
      setLists(ls);
      if (r === "self") setPassport(readPassport());
      else {
        const { data } = await supabase()!.from("passports").select("data").eq("user_id", p.id).maybeSingle();
        setPassport((data?.data as Passport | undefined) ?? null);
      }
    } catch {
      setProfile(null);
    }
  }, [username]);

  useEffect(() => {
    if (!ready || !socialConfigured) return;
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [ready, me, load]);

  if (!socialConfigured) {
    return <AccountsOff what="Profiles" />;
  }
  if (profile === undefined) return <ProfileSkeleton />;
  if (profile === null) {
    return (
      <EmptyState icon={<Users size={30} weight="duotone" />} title={`No one called @${username}`} body="Check the spelling, or find people from the Friends page.">
        <Link href="/friends" className="btn btn-primary">Find friends</Link>
      </EmptyState>
    );
  }

  const name = profile.display_name || profile.username;
  const self = rel === "self";
  const canSeeActivity = self || rel === "friends" || profile.is_public;

  const toggleFollow = async () => {
    if (!me) return openSignIn(`to follow ${name}`);
    setBusy(true);
    try {
      if (rel === "following" || rel === "friends") {
        await unfollow(profile.id);
        setRel(rel === "friends" ? "follower" : "none");
        setStats((s) => ({ ...s, followers: s.followers - 1, friends: rel === "friends" ? s.friends - 1 : s.friends }));
      } else {
        await follow(profile.id);
        setRel(rel === "follower" ? "friends" : "following");
        setStats((s) => ({ ...s, followers: s.followers + 1, friends: rel === "follower" ? s.friends + 1 : s.friends }));
        if (rel === "follower") void load(); // now friends: their plans become visible
      }
    } finally {
      setBusy(false);
    }
  };

  const followLabel =
    rel === "friends" ? "Friends" : rel === "following" ? "Following" : rel === "follower" ? "Follow back" : "Follow";

  const setTab = (t: Tab) => router.replace(`/u/${profile.username}${t === "plans" ? "" : `?tab=${t}`}`, { scroll: false });

  return (
    <div className="profile">
      <header className="pf-head">
        <Avatar src={profile.avatar_url} name={name} size={96} className="pf-avatar" />
        <div className="pf-id">
          <h1 className="pf-name">{name}</h1>
          <p className="pf-handle">
            @{profile.username}
            {rel === "follower" && <span className="pf-chip">Follows you</span>}
            {rel === "friends" && <span className="pf-chip is-friend">Friends</span>}
          </p>
          {profile.bio && <p className="pf-bio">{profile.bio}</p>}
          <p className="pf-meta">
            {profile.city && (
              <span>
                <MapPin size={14} weight="fill" aria-hidden="true" /> {profile.city}
              </span>
            )}
            <span>
              {profile.is_public ? <Globe size={14} weight="bold" aria-hidden="true" /> : <Lock size={14} weight="bold" aria-hidden="true" />}
              {profile.is_public ? "Public profile" : "Plans visible to friends"}
            </span>
          </p>
          <dl className="pf-stats">
            <div><dt>Friends</dt><dd>{stats.friends}</dd></div>
            <div><dt>Followers</dt><dd>{stats.followers}</dd></div>
            <div><dt>Following</dt><dd>{stats.following}</dd></div>
          </dl>
        </div>
        <div className="pf-actions">
          {self ? (
            <Link href="/settings" className="btn btn-ghost">
              <PencilSimple size={16} weight="bold" aria-hidden="true" /> Edit profile
            </Link>
          ) : (
            <button
              type="button"
              className={`btn ${rel === "following" || rel === "friends" ? "btn-ghost" : "btn-primary"}`}
              aria-pressed={rel === "following" || rel === "friends"}
              disabled={busy}
              onClick={toggleFollow}
            >
              {rel === "following" || rel === "friends" ? <UserCheck size={16} weight="bold" aria-hidden="true" /> : <UserPlus size={16} weight="bold" aria-hidden="true" />}
              {followLabel}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              const url = `${window.location.origin}/u/${profile.username}`;
              try {
                if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ url, title: `${name} on Elsewhere` });
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
            {copied ? "Link copied" : "Share"}
          </button>
        </div>
      </header>

      <div className="pf-tabs" role="tablist" aria-label="Profile sections">
        {(["plans", "lists", "passport"] as Tab[]).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} className={tab === t ? "is-on" : ""} onClick={() => setTab(t)}>
            {t === "plans" ? "Plans" : t === "lists" ? `Lists${lists?.length ? ` (${lists.length})` : ""}` : "Passport"}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="pf-panel">
        {tab === "plans" &&
          (!canSeeActivity ? (
            <Locked name={name} rel={rel} onFollow={toggleFollow} />
          ) : plans === null ? (
            <div className="xgrid">{[0, 1, 2].map((i) => <CardSkeleton key={i} />)}</div>
          ) : plans.length === 0 ? (
            <p className="muted pf-empty">
              {self ? "Mark events Going or Interested and they show up here for your friends." : `${name.split(" ")[0]} hasn't marked any upcoming events.`}
            </p>
          ) : (
            <div className="xgrid">
              {plans.map(({ event, status }) => (
                <div key={event.id} className="pf-plan">
                  <EventCard event={event} badge={status === "going" ? "Going" : "Interested"} />
                </div>
              ))}
            </div>
          ))}

        {tab === "lists" && <ListsTab lists={lists} self={self} name={name} onCreated={(l) => setLists((x) => [l, ...(x ?? [])])} />}

        {tab === "passport" &&
          (!canSeeActivity ? (
            <Locked name={name} rel={rel} onFollow={toggleFollow} />
          ) : (
            <>
              <PassportMini passport={passport} />
              {self && (
                <p className="pf-more">
                  <Link href="/passport" className="sec-link">Full passport</Link>
                  <Link href="/recap" className="sec-link">Your month recap</Link>
                </p>
              )}
            </>
          ))}
      </div>
    </div>
  );
}

function Locked({ name, rel, onFollow }: { name: string; rel: Relation; onFollow: () => void }) {
  return (
    <div className="pf-locked">
      <Lock size={26} weight="duotone" aria-hidden="true" />
      <p>
        {name.split(" ")[0]}&apos;s plans are visible to friends.{" "}
        {rel === "following" ? "They'll show once they follow you back." : "Follow each other to see them."}
      </p>
      {rel !== "following" && (
        <button type="button" className="btn btn-primary" onClick={onFollow}>
          <UserPlus size={16} weight="bold" aria-hidden="true" /> {rel === "follower" ? "Follow back" : "Follow"}
        </button>
      )}
    </div>
  );
}

function ListsTab({ lists, self, name, onCreated }: { lists: List[] | null; self: boolean; name: string; onCreated: (l: List) => void }) {
  const [title, setTitle] = useState("");
  const [vis, setVis] = useState<Visibility>("friends");
  const [err, setErr] = useState<string | null>(null);
  if (lists === null) return <p className="muted">Loading lists…</p>;
  return (
    <div className="pf-lists">
      {self && (
        <form
          className="pf-newlist"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            try {
              onCreated(await createList(title, vis));
              setTitle("");
              setErr(null);
            } catch (e2) {
              setErr(e2 instanceof Error ? e2.message : "Couldn't create the list.");
            }
          }}
        >
          <label htmlFor="pf-list-title" className="sr-only">New list name</label>
          <input id="pf-list-title" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="New list, e.g. Monsoon weekends" />
          <label htmlFor="pf-list-vis" className="sr-only">Who can see it</label>
          <select id="pf-list-vis" value={vis} onChange={(e) => setVis(e.target.value as Visibility)}>
            {(Object.keys(VIS_LABEL) as Visibility[]).map((v) => (
              <option key={v} value={v}>{VIS_LABEL[v]}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary">
            <Plus size={16} weight="bold" aria-hidden="true" /> Create
          </button>
          {err && <p className="esocial-err" role="alert">{err}</p>}
        </form>
      )}
      {lists.length === 0 ? (
        <p className="muted pf-empty">{self ? "Make a list, then add events to it from any event page." : `No lists from ${name.split(" ")[0]} that you can see.`}</p>
      ) : (
        <ul className="pf-listgrid">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/lists/${l.id}`} className="pf-listcard">
                <strong>{l.title}</strong>
                {l.description && <span className="pf-listdesc">{l.description}</span>}
                <span className="pf-listvis">
                  {l.visibility === "public" ? <Globe size={13} weight="bold" aria-hidden="true" /> : <Lock size={13} weight="bold" aria-hidden="true" />}
                  {VIS_LABEL[l.visibility]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PassportMini({ passport }: { passport: Passport | null }) {
  if (!passport || !passport.cats) return <p className="muted pf-empty">No stamps yet.</p>;
  const got = CATEGORIES.filter((c) => c.value !== "other" && passport.cats[c.value]);
  const earned = badges(mergePassports(EMPTY_PASSPORT, passport), 0).filter((b) => b.earned && b.id !== "regular");
  return (
    <div className="pf-passport">
      <ul className="pf-stamps">
        {got.map((c) => (
          <li key={c.value} style={{ "--cat-hue": getCategoryColor(c.value).color } as React.CSSProperties}>
            <CategoryIcon category={c.value} size={20} weight="fill" />
            {c.label}
          </li>
        ))}
        {got.length === 0 && <li className="muted">No stamps yet.</li>}
      </ul>
      {earned.length > 0 && (
        <p className="pf-badges">
          Badges: {earned.map((b) => b.title).join(", ")}
        </p>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="profile" aria-busy="true" aria-label="Loading profile">
      <header className="pf-head">
        <span className="skel" style={{ width: 96, height: 96, borderRadius: "50%" }} />
        <div className="pf-id">
          <span className="skel skel-title" />
          <span className="skel skel-line" />
        </div>
      </header>
    </div>
  );
}
