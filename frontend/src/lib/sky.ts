/**
 * The hero sky follows the real time of day in the chosen city (IST for India). Pure; the hook
 * that ticks lives with the component.
 */
export type SkyPhase = "dawn" | "day" | "dusk" | "night";

export function istHour(now: number): number {
  const d = new Date(now + 5.5 * 3_600_000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

/** Hour of day (with minutes as a fraction) in any IANA zone. */
export function zoneHour(now: number, zone: string): number {
  if (zone === "Asia/Kolkata") return istHour(now);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => +(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") + get("minute") / 60;
}

export function skyPhase(now: number, zone = "Asia/Kolkata"): SkyPhase {
  const h = zoneHour(now, zone);
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 19.5) return "dusk";
  return "night";
}

/** How bright the city lights should read (they wash out in daylight). */
export const SKY_LIGHTS: Record<SkyPhase, number> = { dawn: 0.75, day: 0.55, dusk: 0.9, night: 1 };
