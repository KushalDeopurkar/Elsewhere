"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "@phosphor-icons/react/ssr";
import Avatar from "./Avatar";
import { EmptyState } from "./Section";
import { openSignIn, refreshProfile, signOut, socialConfigured, useAuth } from "@/lib/auth";
import { updateProfile, USERNAME_RE } from "@/lib/social";
import { CITY_LIST } from "@/lib/cities";

export default function SettingsView() {
  const { ready, session, profile } = useAuth();
  const router = useRouter();
  const [form, setFormRaw] = useState({ username: "", display_name: "", bio: "", city: "", is_public: false });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const setForm = (f: typeof form) => {
    setFormRaw(f);
    setMsg(null);
  };

  // Fill the form once per profile (deriving during render, not in an effect).
  if (profile && loadedFor !== profile.id) {
    setLoadedFor(profile.id);
    setFormRaw({
      username: profile.username,
      display_name: profile.display_name ?? "",
      bio: profile.bio ?? "",
      city: profile.city ?? "",
      is_public: profile.is_public,
    });
  }

  if (!socialConfigured) return <EmptyState icon={null} title="Accounts aren't switched on yet" body="" />;
  if (!ready) return <p className="muted">Loading…</p>;
  if (!session) {
    return (
      <EmptyState icon={null} title="Sign in to edit your profile" body="">
        <button type="button" className="btn btn-primary" onClick={() => openSignIn("to edit your profile")}>Sign in</button>
      </EmptyState>
    );
  }
  if (!profile) return <p className="muted">Loading your profile…</p>;

  const uname = form.username.trim().toLowerCase();
  const unameErr = USERNAME_RE.test(uname) ? null : "3 to 20 characters: lowercase letters, numbers and _";

  return (
    <form
      className="settings"
      onSubmit={async (e) => {
        e.preventDefault();
        if (unameErr) return;
        setSaving(true);
        try {
          await updateProfile({
            username: uname,
            display_name: form.display_name.trim().slice(0, 50) || null,
            bio: form.bio.trim().slice(0, 160) || null,
            city: form.city || null,
            is_public: form.is_public,
          });
          await refreshProfile();
          setMsg({ ok: true, text: "Saved." });
          if (uname !== profile.username) router.replace("/settings");
        } catch (err) {
          setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't save." });
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="st-avatar">
        <Avatar src={profile.avatar_url} name={form.display_name || form.username} size={72} />
        <p className="muted">Your picture comes from your Google account.</p>
      </div>

      <div className="st-field">
        <label htmlFor="st-name">Name</label>
        <input id="st-name" value={form.display_name} maxLength={50} autoComplete="name" onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
      </div>

      <div className="st-field">
        <label htmlFor="st-user">Username</label>
        <div className="st-prefix">
          <span aria-hidden="true">@</span>
          <input
            id="st-user"
            value={form.username}
            maxLength={20}
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(unameErr) || undefined}
            aria-describedby="st-user-help"
            onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
          />
        </div>
        <p id="st-user-help" className={unameErr ? "st-err" : "st-help"}>{unameErr ?? `Your profile: /u/${uname}`}</p>
      </div>

      <div className="st-field">
        <label htmlFor="st-bio">Bio</label>
        <textarea id="st-bio" rows={3} maxLength={160} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} aria-describedby="st-bio-help" />
        <p id="st-bio-help" className="st-help">{160 - form.bio.length} characters left</p>
      </div>

      <div className="st-field">
        <label htmlFor="st-city">City</label>
        <select id="st-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
          <option value="">Not shown</option>
          {CITY_LIST.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      <fieldset className="st-field st-privacy">
        <legend>Who can see your plans, lists marked Friends, and passport</legend>
        <label className="st-radio">
          <input type="radio" name="vis" checked={!form.is_public} onChange={() => setForm({ ...form, is_public: false })} />
          <span><strong>Friends only</strong><small>People you follow who follow you back.</small></span>
        </label>
        <label className="st-radio">
          <input type="radio" name="vis" checked={form.is_public} onChange={() => setForm({ ...form, is_public: true })} />
          <span><strong>Everyone</strong><small>Anyone who opens your profile.</small></span>
        </label>
        <p className="st-help">Your name, @username and picture are always visible so friends can find you.</p>
      </fieldset>

      <div className="st-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || Boolean(unameErr)}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        <Link href={`/u/${profile.username}`} className="btn btn-ghost">View profile</Link>
        {msg && (
          <p className={msg.ok ? "st-ok" : "st-err"} role="status">
            {msg.ok && <Check size={15} weight="bold" aria-hidden="true" />} {msg.text}
          </p>
        )}
      </div>
      <button type="button" className="disc-link st-signout" onClick={() => void signOut().then(() => router.push("/"))}>
        Sign out
      </button>
    </form>
  );
}
