/**
 * Day and night. By default the site follows the sun in the chosen city: the
 * printed timetable by day, the lit departure board from 18:00 to 06:00. The
 * person can pin either one in Settings.
 *
 * The same rule runs twice: as a tiny inline script before first paint (so a
 * night visit never flashes paper), and as a hook that keeps it current when
 * the hour turns or the city changes.
 */

import { CITY_LIST } from "./cities";
import { zoneHour } from "./sky";

export type ThemePref = "auto" | "day" | "night";
export type Theme = "day" | "night";

export const THEME_KEY = "ee.theme.v1";
export const CITY_KEY = "ee.city.v1";

/** Night from 18:00 until 06:00 local time in the city. */
export function themeAt(now: number, zone: string): Theme {
  const h = zoneHour(now, zone);
  return h >= 18 || h < 6 ? "night" : "day";
}

export function resolveTheme(pref: ThemePref, now: number, zone: string): Theme {
  return pref === "auto" ? themeAt(now, zone) : pref;
}

/** City name to time zone, for the cities outside India's single zone. */
function zonesOutsideIndia(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of CITY_LIST) if (c.tz && c.tz !== "Asia/Kolkata") out[c.name] = c.tz;
  return out;
}

/** Inline, before paint. Kept dependency-free; storage may be blocked. */
export function themeBootScript(): string {
  const zones = JSON.stringify(zonesOutsideIndia());
  return `(function(){try{var d=document.documentElement,p="auto",c="Mumbai";try{p=JSON.parse(localStorage.getItem(${JSON.stringify(
    THEME_KEY,
  )}))||"auto";c=JSON.parse(localStorage.getItem(${JSON.stringify(
    CITY_KEY,
  )}))||"Mumbai"}catch(e){}var t=p;if(p!=="day"&&p!=="night"){var z=${zones}[c]||"Asia/Kolkata",h=+new Intl.DateTimeFormat("en-GB",{timeZone:z,hour:"numeric",hourCycle:"h23"}).format(new Date());t=h>=18||h<6?"night":"day"}d.dataset.theme=t}catch(e){}})();`;
}
