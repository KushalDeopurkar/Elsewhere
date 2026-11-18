"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadSimple, ShareNetwork, X } from "@phosphor-icons/react/ssr";
import type { Event } from "@/lib/types";
import { onMarkedGoing } from "@/lib/going";
import { useAuth } from "@/lib/auth";
import { formatFull } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import { sfx } from "@/lib/sound";

/** Barcode widths from the event id, matching /api/ticket. */
function bars(seed: string): number[] {
  let x = 2166136261;
  for (const c of seed) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
  return Array.from({ length: 34 }, () => {
    x = Math.imul(x ^ (x >>> 15), 2246822507) >>> 0;
    return 1 + (x % 4);
  });
}

/**
 * The commitment moment: mark an event Going and a ticket stub prints out of
 * a slot, ready to share as a picture. A keepsake, not an entry pass.
 */
export default function TicketStub({ event }: { event: Event }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const name = profile?.display_name || profile?.username || "You";

  useEffect(
    () =>
      onMarkedGoing((id) => {
        if (id !== event.id) return;
        sfx("stamp");
        setOpen(true);
      }),
    [event.id],
  );
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const src = `/api/ticket?${new URLSearchParams({ id: event.id, name })}`;
  const share = async () => {
    setBusy(true);
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], "elsewhere-ticket.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: event.title });
      else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "elsewhere-ticket.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    } catch {
      /* cancelled */
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="stub-dialog" aria-label="You're going" onClose={() => setOpen(false)} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      {open && (
        <div className="stub-wrap">
          <button type="button" className="icon-btn stub-x" aria-label="Close" onClick={() => setOpen(false)}>
            <X size={18} weight="bold" />
          </button>
          <p className="stub-head">You&apos;re going</p>
          <div className="stub-slot" aria-hidden="true" />
          <div className="stub">
            <div className="stub-top">
              {event.image_url && <img src={event.image_url} alt="" referrerPolicy="no-referrer" />}
              <span className="stub-badge">I&apos;m going</span>
            </div>
            <div className="stub-body">
              <p className="stub-admit">Admit one · {name}</p>
              <p className="stub-title">{event.title}</p>
              <p className="stub-meta">{formatFull(event.start_time)}</p>
              {event.location_name && <p className="stub-meta">{event.location_name}</p>}
            </div>
            <div className="stub-perf" aria-hidden="true" />
            <div className="stub-foot">
              <span>
                <small>Entry</small>
                <strong>{priceBadge(event)}</strong>
              </span>
              <span className="stub-bars" aria-hidden="true">
                {bars(event.id).map((w, i) => (
                  <i key={i} style={{ width: w }} />
                ))}
              </span>
            </div>
          </div>
          <p className="stub-note">Your friends can see you&apos;re going. Book through the organiser; this stub is just for sharing.</p>
          <div className="stub-actions">
            <button type="button" className="btn btn-primary" onClick={share} disabled={busy}>
              <ShareNetwork size={17} weight="bold" aria-hidden="true" /> {busy ? "Preparing…" : "Share stub"}
            </button>
            <a className="btn btn-ghost" href={src} download="elsewhere-ticket.png">
              <DownloadSimple size={17} weight="bold" aria-hidden="true" /> Save
            </a>
          </div>
        </div>
      )}
    </dialog>
  );
}
