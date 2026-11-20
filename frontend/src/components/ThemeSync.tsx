"use client";

import { useEffect } from "react";
import { createStore } from "@/lib/clientStore";
import { useNow } from "@/lib/clock";
import { useCity } from "@/lib/cityPref";
import { cityZone } from "@/lib/cities";
import { paletteOf, resolveTheme, THEME_KEY, type Theme, type ThemePref } from "@/lib/theme";

const store = createStore<ThemePref>(THEME_KEY, "auto");

export function useThemePref(): ThemePref {
  return store.useValue();
}

export function setThemePref(pref: ThemePref): void {
  store.write(pref);
}

/** The theme in force right now: the pinned one, or the sun's. Null on the server. */
export function useTheme(): Theme | null {
  const pref = store.useValue();
  const now = useNow(60_000);
  const zone = cityZone(useCity());
  return now ? resolveTheme(pref, now, zone) : null;
}

/** Keeps <html data-theme> in step with the hour, the city and the setting. */
export default function ThemeSync() {
  const theme = useTheme();
  const palette = paletteOf(useThemePref());
  useEffect(() => {
    const root = document.documentElement;
    if (!theme) return;
    const want = palette === "vivid" ? "vivid" : undefined;
    if (root.dataset.theme === theme && root.dataset.palette === want) return;
    if (want) root.dataset.palette = want;
    else delete root.dataset.palette;
    root.dataset.themeSwitching = "";
    root.dataset.theme = theme;
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) =>
        m.setAttribute("content", palette === "vivid" ? "#171613" : theme === "night" ? "#10172b" : "#f9fafc"),
      );
    const id = window.setTimeout(() => delete root.dataset.themeSwitching, 300);
    return () => window.clearTimeout(id);
  }, [theme, palette]);
  return null;
}
