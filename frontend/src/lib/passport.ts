"use client";

/** The passport store (this device) and its toast feed. */
import { createStore } from "./clientStore";
import { CATEGORIES, type Event } from "./types";
import { EMPTY_PASSPORT, badges, newlyEarned, stampEvent, type Passport } from "./passportCore";
import { readStreak } from "./streak";

export * from "./passportCore";

const store = createStore<Passport>("ee.passport.v1", EMPTY_PASSPORT);
export const usePassport = store.useValue;
export const readPassport = store.read;
export function writePassport(p: Passport): void {
  store.write(p);
  passportSink?.(p);
}
let passportSink: ((p: Passport) => void) | null = null;
/** Mirror passport changes to the account (set by lib/sync). */
export function setPassportSink(fn: ((p: Passport) => void) | null): void {
  passportSink = fn;
}

export interface PassportNews {
  id: number;
  title: string;
  body: string;
  kind: "stamp" | "badge";
}
type Listener = (n: PassportNews) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function onPassportNews(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

const label = (c: Event["category"]) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** Stamp an event the person opened or saved; announces first-time stamps and new badges. */
export function stampPassport(e: Event): void {
  if (e.source === "sample") return;
  const before = store.read();
  const streak = readStreak();
  const { next, fresh } = stampEvent(before, e, new Date().toISOString(), label);
  if (next === before) return;
  store.write(next);
  passportSink?.(next);
  const earned = newlyEarned(badges(before, streak), badges(next, streak));
  const news: Omit<PassportNews, "id">[] = [
    ...earned.map((b) => ({ kind: "badge" as const, title: `Badge earned: ${b.title}`, body: b.desc })),
    ...fresh
      .filter((s) => s.kind === "category")
      .map((s) => ({ kind: "stamp" as const, title: "New passport stamp", body: s.label })),
  ];
  news.slice(0, 2).forEach((n) => listeners.forEach((l) => l({ ...n, id: nextId++ })));
}

export function resetPassport(): void {
  store.write(EMPTY_PASSPORT);
}
