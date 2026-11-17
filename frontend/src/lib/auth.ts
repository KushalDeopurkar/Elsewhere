"use client";

/**
 * The signed-in person, shared app-wide through useSyncExternalStore.
 * Session handling (refresh, the sign-in redirect) is Supabase's; this keeps
 * the current session and the person's profile row together, and opens the
 * sign-in dialog from anywhere.
 */
import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, socialConfigured } from "./supabase";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  is_public: boolean;
}

export interface AuthState {
  /** false until the stored session has been read. */
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Why the sign-in dialog is open ("to mark yourself going"), or null when closed. */
  prompt: string | null;
}

let state: AuthState = { ready: false, session: null, profile: null, prompt: null };
const SERVER: AuthState = state;
const listeners = new Set<() => void>();
const set = (patch: Partial<AuthState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

type SignInHook = (userId: string) => void;
const onSignInHooks = new Set<SignInHook>();
/** Run something once each time someone signs in (syncing saves, passport). */
export function onSignIn(fn: SignInHook): () => void {
  onSignInHooks.add(fn);
  if (state.session) fn(state.session.user.id);
  return () => onSignInHooks.delete(fn);
}

let started = false;
function start() {
  if (started) return;
  started = true;
  const sb = supabase();
  if (!sb) {
    set({ ready: true });
    return;
  }
  let lastUser: string | null = null;
  const apply = async (session: Session | null) => {
    const uid = session?.user.id ?? null;
    set({ session, ready: true, profile: uid && state.profile?.id === uid ? state.profile : null });
    if (uid) {
      await refreshProfile();
      if (uid !== lastUser) onSignInHooks.forEach((f) => f(uid));
    }
    lastUser = uid;
  };
  void sb.auth.getSession().then(({ data }) => apply(data.session));
  sb.auth.onAuthStateChange((_event, session) => {
    // Supabase warns against awaiting its client inside this callback.
    setTimeout(() => void apply(session), 0);
  });
}

const subscribe = (l: () => void) => {
  start();
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}

export function currentUserId(): string | null {
  return state.session?.user.id ?? null;
}

export async function refreshProfile(): Promise<void> {
  const sb = supabase();
  const uid = state.session?.user.id;
  if (!sb || !uid) return;
  const { data } = await sb.from("profiles").select("id, username, display_name, avatar_url, bio, city, is_public").eq("id", uid).maybeSingle();
  if (state.session?.user.id === uid) set({ profile: (data as Profile | null) ?? null });
}

export function openSignIn(reason = "to use social features"): void {
  set({ prompt: reason });
}
export function closeSignIn(): void {
  set({ prompt: null });
}

const NEXT_KEY = "ee.auth.next";
function rememberReturn() {
  try {
    sessionStorage.setItem(NEXT_KEY, window.location.pathname + window.location.search);
  } catch {
    /* storage blocked: the callback falls back to home */
  }
}
export function takeReturnPath(): string {
  try {
    const p = sessionStorage.getItem(NEXT_KEY);
    sessionStorage.removeItem(NEXT_KEY);
    if (p && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/auth")) return p;
  } catch {
    /* ignore */
  }
  return "/";
}

const callbackUrl = () => `${window.location.origin}/auth/callback`;

export async function signInWithGoogle(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return "Sign-in isn't set up yet.";
  rememberReturn();
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl() } });
  return error?.message ?? null;
}

export async function signInWithEmail(email: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return "Sign-in isn't set up yet.";
  rememberReturn();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl(), shouldCreateUser: true } });
  return error?.message ?? null;
}

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut();
  set({ session: null, profile: null });
}

export { socialConfigured };
