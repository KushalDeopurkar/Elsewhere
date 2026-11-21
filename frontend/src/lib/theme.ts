/**
 * Day and night. By default the site matches the device: light when the
 * system is in light mode, the lit departure board when it is in dark mode,
 * and it switches with the system. The person can pin either one in
 * Settings, or pick Vivid: night in full colour (the transit map at night:
 * charcoal, flat line colours, a vermilion signal).
 *
 * The same rule runs twice: as a tiny inline script before first paint (so a
 * dark-mode visit never flashes paper), and as a hook that follows the
 * system setting when it changes.
 */

export type ThemePref = "auto" | "day" | "night" | "vivid";
export type Theme = "day" | "night";
/** Which night: the departure board, or the colourful one. Set as <html data-palette>. */
export type Palette = "board" | "vivid";

export const THEME_KEY = "ee.theme.v1";
export const CITY_KEY = "ee.city.v1";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** "auto" follows the device's light or dark setting. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  if (pref === "vivid") return "night";
  if (pref === "day" || pref === "night") return pref;
  return systemDark ? "night" : "day";
}

export function paletteOf(pref: ThemePref): Palette {
  return pref === "vivid" ? "vivid" : "board";
}

/** Inline, before paint. Kept dependency-free; storage may be blocked. */
export function themeBootScript(): string {
  return `(function(){try{var d=document.documentElement,p="auto";try{p=JSON.parse(localStorage.getItem(${JSON.stringify(
    THEME_KEY,
  )}))||"auto"}catch(e){}var t=p;if(p==="vivid"){t="night";d.dataset.palette="vivid"}else if(p!=="day"&&p!=="night"){var m=window.matchMedia&&window.matchMedia(${JSON.stringify(
    DARK_QUERY,
  )});t=m&&m.matches?"night":"day"}d.dataset.theme=t}catch(e){}})();`;
}
