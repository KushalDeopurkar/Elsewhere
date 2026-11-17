"use client";

import { Timer } from "@phosphor-icons/react/ssr";
import type { Ticket } from "@/lib/types";
import { useNow } from "@/lib/clock";
import { hasTime } from "@/lib/formatDate";
import { salesCountdown, startCountdown } from "@/lib/countdown";

/** "Starts in 2h 14m" / "On now", ticking. Renders nothing far out or on the server. */
export function StartCountdown({ start, end }: { start: string; end: string | null }) {
  const now = useNow(15_000);
  const c = now ? startCountdown(start, end, now, { hasTime: hasTime(start) }) : null;
  if (!c) return null;
  return (
    <p className={`countdown is-${c.tone}`} role="timer" aria-live="off">
      {c.tone === "live" ? <span className="live-dot" aria-hidden="true" /> : <Timer size={15} weight="bold" aria-hidden="true" />}
      {c.label}
    </p>
  );
}

/** "Sales end in 3h 5m" from the soonest real tier cut-off within 3 days. */
export function SalesCountdown({ tickets }: { tickets: Ticket[] }) {
  const now = useNow(15_000);
  const label = now ? salesCountdown(tickets, now) : null;
  if (!label) return null;
  return (
    <p className="countdown is-sales" role="timer" aria-live="off">
      <Timer size={15} weight="bold" aria-hidden="true" />
      {label}
    </p>
  );
}
