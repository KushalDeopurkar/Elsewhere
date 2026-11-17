"use client";

import { useNow } from "@/lib/clock";
import { skyPhase, type SkyPhase } from "@/lib/sky";

/** Time of day in India, re-read every minute. "night" during SSR (the default look). */
export function useSky(): SkyPhase {
  const now = useNow(60_000);
  return now ? skyPhase(now) : "night";
}
