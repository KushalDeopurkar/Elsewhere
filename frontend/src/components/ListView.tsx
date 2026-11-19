"use client";

import AccountsOff from "./AccountsOff";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, Lock, Users, Trash, LinkSimple, Check, X } from "@phosphor-icons/react/ssr";
import Avatar from "./Avatar";
import EventCard from "./EventCard";
import ShareCard from "./ShareCard";
import { CardSkeleton, EmptyState } from "./Section";
import { socialConfigured, useAuth, type Profile } from "@/lib/auth";
import { deleteList, getList, setInList, updateList, type List, type Visibility } from "@/lib/social";
import type { Event } from "@/lib/types";

const VIS: { v: Visibility; label: string; icon: typeof Globe }[] = [
  { v: "private", label: "Only you", icon: Lock },
  { v: "friends", label: "Friends", icon: Users },
  { v: "public", label: "Anyone with the link", icon: Globe },
];

/** One list: its events, who made it, and (for the owner) privacy and editing. */
export default function ListView({ id }: { id: string }) {
  const { ready, session } = useAuth();
  const me = session?.user.id ?? null;
  const router = useRouter();
  const [data, setData] = useState<{ list: List; owner: Profile | null; events: Event[] } | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    getList(id)
      .then(setData)
      .catch(() => setData(null));
  }, [id]);
  useEffect(() => {
    if (ready && socialConfigured) load();
  }, [ready, me, load]);

  if (!socialConfigured) return <AccountsOff what="Lists" />;
  if (data === undefined) {
    return (
      <div className="xgrid list-page" aria-busy="true">
        {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
      </div>
    );
  }
  if (data === null) {
    return (
      <EmptyState icon={<Lock size={30} weight="duotone" />} title="This list is private or gone" body="Lists can be visible to just their owner, to friends, or to anyone with the link.">
        <Link href="/" className="btn btn-primary">Back home</Link>
      </EmptyState>
    );
  }

  const { list, owner, events } = data;
  const mine = me === list.owner;
  const ownerName = owner?.display_name || owner?.username || "Someone";

  return (
    <div className="list-page">
      <header className="lp-head">
        <p className="sec-kicker">List</p>
        <h1 className="lp-title">{list.title}</h1>
        {list.description && <p className="lp-desc">{list.description}</p>}
        {owner && (
          <Link href={`/u/${owner.username}`} className="lp-owner">
            <Avatar src={owner.avatar_url} name={ownerName} size={28} /> {ownerName}
          </Link>
        )}
        <div className="lp-actions">
          {mine ? (
            <div className="sharecard-tabs lp-vis" role="radiogroup" aria-label="Who can see this list">
              {VIS.map(({ v, label, icon: Icon }) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={list.visibility === v}
                  className={list.visibility === v ? "is-on" : ""}
                  onClick={async () => {
                    setData({ ...data, list: { ...list, visibility: v } });
                    await updateList(list.id, { visibility: v }).catch(load);
                  }}
                >
                  <Icon size={14} weight="bold" aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
          ) : (
            <span className="pf-listvis">{VIS.find((x) => x.v === list.visibility)?.label}</span>
          )}
          {list.visibility !== "private" && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href).catch(() => undefined);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? <Check size={16} weight="bold" aria-hidden="true" /> : <LinkSimple size={16} weight="bold" aria-hidden="true" />}
              {copied ? "Link copied" : "Copy link"}
            </button>
          )}
          {events.length > 0 && <ShareCard ids={events.map((e) => e.id)} title={list.title} kicker={`A list by ${ownerName.split(" ")[0]}`} label="Make a card" />}
          {mine && (
            <button
              type="button"
              className="btn btn-ghost lp-delete"
              onClick={async () => {
                if (!window.confirm(`Delete “${list.title}”?`)) return;
                await deleteList(list.id);
                router.push(owner ? `/u/${owner.username}?tab=lists` : "/");
              }}
            >
              <Trash size={16} weight="bold" aria-hidden="true" /> Delete
            </button>
          )}
        </div>
      </header>

      {events.length === 0 ? (
        <p className="muted">{mine ? "Nothing here yet. Use “Add to list” on any event page." : "This list is empty."}</p>
      ) : (
        <div className="xgrid">
          {events.map((e) => (
            <div key={e.id} className="saved-item">
              <EventCard event={e} />
              {mine && (
                <button
                  type="button"
                  className="saved-remove"
                  onClick={async () => {
                    setData({ ...data, events: events.filter((x) => x.id !== e.id) });
                    await setInList(list.id, e.id, false).catch(load);
                  }}
                >
                  <X size={14} weight="bold" aria-hidden="true" /> Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
