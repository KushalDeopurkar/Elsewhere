"use client";

/** Days in a row the person has come back to swipe. Kept on this device. */
import { createStore } from "./clientStore";

interface Streak { last: string; days: number }
const store = createStore<Streak>("ee.streak.v1", { last: "", days: 0 });

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function useStreak(): number {
  return store.useValue().days;
}

/** Call on the first swipe of a visit. */
export function touchStreak(now = new Date()): void {
  const s = store.read();
  const today = dayKey(now);
  if (s.last === today) return;
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  store.write({ last: today, days: s.last === yesterday ? s.days + 1 : 1 });
}
