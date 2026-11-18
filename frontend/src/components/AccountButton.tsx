"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle, Users, GearSix, SignOut, Medal, ListBullets, FilmSlate } from "@phosphor-icons/react/ssr";
import Avatar from "./Avatar";
import { openSignIn, signOut, socialConfigured, useAuth } from "@/lib/auth";

/** "Sign in" for guests; an avatar with a small menu for signed-in people. */
export default function AccountButton() {
  const { ready, session, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!socialConfigured) return null;
  if (!ready) return <span className="acct-skel" aria-hidden="true" />;
  if (!session) {
    return (
      <button type="button" className="btn btn-ghost acct-signin" onClick={() => openSignIn("to follow friends and see who's going")}>
        Sign in
      </button>
    );
  }
  const name = profile?.display_name || profile?.username || session.user.email || "You";
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  return (
    <div className="acct" ref={wrap}>
      <button type="button" className="acct-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Your account" onClick={() => setOpen((o) => !o)}>
        <Avatar src={profile?.avatar_url} name={name} size={32} />
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <p className="acct-who">
            <strong>{name}</strong>
            {profile && <span>@{profile.username}</span>}
          </p>
          {profile && (
            <button role="menuitem" type="button" onClick={() => go(`/u/${profile.username}`)}>
              <UserCircle size={18} weight="bold" aria-hidden="true" /> Your profile
            </button>
          )}
          <button role="menuitem" type="button" onClick={() => go("/friends")}>
            <Users size={18} weight="bold" aria-hidden="true" /> Friends
          </button>
          {profile && (
            <button role="menuitem" type="button" onClick={() => go(`/u/${profile.username}?tab=lists`)}>
              <ListBullets size={18} weight="bold" aria-hidden="true" /> Your lists
            </button>
          )}
          <button role="menuitem" type="button" onClick={() => go("/passport")}>
            <Medal size={18} weight="bold" aria-hidden="true" /> Passport
          </button>
          <button role="menuitem" type="button" onClick={() => go("/recap")}>
            <FilmSlate size={18} weight="bold" aria-hidden="true" /> Your month recap
          </button>
          <button role="menuitem" type="button" onClick={() => go("/settings")}>
            <GearSix size={18} weight="bold" aria-hidden="true" /> Edit profile
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
          >
            <SignOut size={18} weight="bold" aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
