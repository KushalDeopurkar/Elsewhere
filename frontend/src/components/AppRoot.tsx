"use client";

import { useEffect } from "react";
import { useSaved } from "@/lib/saved";
import { isRealEvent } from "@/lib/supabase";
import { captureInstallPrompt, registerWorker, syncReminders, useReminders } from "@/lib/push";

/**
 * Installable-app plumbing: catches the install prompt, keeps the service
 * worker registered while reminders are on, and re-sends the reminder list
 * whenever saves change (on any page, not just Saved).
 */
export default function AppRoot() {
  const saved = useSaved();
  const { on } = useReminders();

  useEffect(() => captureInstallPrompt(), []);

  useEffect(() => {
    if (on) registerWorker()?.catch(() => {});
  }, [on]);

  useEffect(() => {
    if (!on) return;
    const t = window.setTimeout(() => {
      syncReminders(saved.map((s) => s.event).filter(isRealEvent)).catch(() => {});
    }, 800);
    return () => window.clearTimeout(t);
  }, [on, saved]);

  return null;
}
