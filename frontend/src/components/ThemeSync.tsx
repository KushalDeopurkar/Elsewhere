"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createStore } from "@/lib/clientStore";
import { DARK_QUERY, paletteOf, resolveTheme, THEME_KEY, type Theme, type ThemePref } from "@/lib/theme";

const store = createStore<ThemePref>(THEME_KEY, "auto");

export function useThemePref(): ThemePref {
  return store.useValue();
}

export function setThemePref(pref: ThemePref): void {
  store.write(pref);
}

/** The device's light or dark setting, kept current; null on the server. */
function subscribeDark(onChange: () => void): () => void {
  const m = window.matchMedia(DARK_QUERY);
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}
function useSystemDark(): boolean | null {
  return useSyncExternalStore(
    subscribeDark,
    () => window.matchMedia(DARK_QUERY).matches,
    () => null,
  );
}

/** The theme in force right now: the pinned one, or the device's. Null on the server. */
export function useTheme(): Theme | null {
  const pref = store.useValue();
  const dark = useSystemDark();
  return dark === null ? null : resolveTheme(pref, dark);
}

/** Keeps <html data-theme> in step with the device and the setting. */
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
