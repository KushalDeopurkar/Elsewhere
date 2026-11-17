/**
 * The hero sky follows the real time of day in India (IST). Pure; the hook
 * that ticks lives with the component.
 */
export type SkyPhase = "dawn" | "day" | "dusk" | "night";

export function istHour(now: number): number {
  const d = new Date(now + 5.5 * 3_600_000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export function skyPhase(now: number): SkyPhase {
  const h = istHour(now);
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 19.5) return "dusk";
  return "night";
}

/** How bright the city lights should read (they wash out in daylight). */
export const SKY_LIGHTS: Record<SkyPhase, number> = { dawn: 0.75, day: 0.55, dusk: 0.9, night: 1 };
