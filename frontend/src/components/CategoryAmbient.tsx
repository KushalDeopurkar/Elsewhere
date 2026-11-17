"use client";

import { useEffect } from "react";
import type { EventCategory } from "@/lib/types";
import { playAmbient, stopAmbient, useSoundOn } from "@/lib/sound";

/** Plays the category's soft ambient bed while this page is open, if sound is on. */
export default function CategoryAmbient({ category }: { category: EventCategory }) {
  const on = useSoundOn();
  useEffect(() => {
    if (!on) return;
    playAmbient(category);
    return () => stopAmbient();
  }, [on, category]);
  return null;
}
