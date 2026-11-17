"use client";

import { useSyncExternalStore } from "react";

/**
 * True only on wide, mouse-driven screens that allow motion and have WebGL.
 * Phones, tablets and reduced-motion users get the lighter hero instead.
 */
const QUERY = "(min-width: 1000px) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

let webgl: boolean | null = null;
function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement("canvas");
    webgl = Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  return webgl;
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useCapable3D(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches && hasWebGL(),
    () => false,
  );
}
