"use client";

import { useNow } from "@/lib/clock";
import { useCity } from "@/lib/cityPref";
import { cityZone } from "@/lib/cities";
import { skyPhase, type SkyPhase } from "@/lib/sky";

/** Time of day in the chosen city, re-read every minute. "night" during SSR (the default look). */
export function useSky(): SkyPhase {
  const now = useNow(60_000);
  const zone = cityZone(useCity());
  return now ? skyPhase(now, zone) : "night";
}
