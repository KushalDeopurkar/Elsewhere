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

/**
 * Keeps <html data-theme> in step with the device and the setting.
 *
 * The switch is a crossfade of the whole page: the browser snapshots the
 * old look and the new one and fades between them on the GPU (View
 * Transitions). Fading every element's colours instead looked patchy:
 * gradients, the contour map, icons and pictures can't fade that way, so
 * they snapped while text faded. Without View Transitions (or with reduced
 * motion), the theme changes in one step, all at once.
 */
export default function ThemeSync() {
  const theme = useTheme();
  const palette = paletteOf(useThemePref());
  useEffect(() => {
    const root = document.documentElement;
    if (!theme) return;
    const want = palette === "vivid" ? "vivid" : undefined;
    if (root.dataset.theme === theme && root.dataset.palette === want) return;

    const apply = () => {
      if (want) root.dataset.palette = want;
      else delete root.dataset.palette;
      root.dataset.theme = theme;
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((m) =>
          m.setAttribute("content", palette === "vivid" ? "#171613" : theme === "night" ? "#10172b" : "#f9fafc"),
        );
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = (document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } })
      .startViewTransition;
    // Hidden tabs can't run a transition; neither can reduced motion want one.
    if (!start || reduce || document.visibilityState !== "visible") {
      root.dataset.themeSwitching = "";
      apply();
      const id = window.setTimeout(() => delete root.dataset.themeSwitching, 50);
      return () => window.clearTimeout(id);
    }
    root.dataset.vt = "theme";
    // The live page sits under the snapshots: its own colour transitions
    // would only be wasted work, so they are off until the fade ends.
    root.dataset.themeSwitching = "";
    const done = () => {
      if (root.dataset.vt === "theme") delete root.dataset.vt;
      delete root.dataset.themeSwitching;
    };
    try {
      const vt = start.call(document, apply);
      vt.finished.catch(() => {}).finally(done);
    } catch {
      apply();
      done();
    }
  }, [theme, palette]);
  return null;
}
