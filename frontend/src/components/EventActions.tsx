"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { MapTrifold } from "@phosphor-icons/react/ssr";
import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ShareNetwork, Check, WhatsappLogo } from "@phosphor-icons/react/ssr";
import { whatsappUrl, eventShareText } from "@/lib/share";
import { googleCalendarLink, planToIcs } from "@/lib/plan";
import type { PlanResult } from "@/lib/plan";
import type { Event } from "@/lib/types";
import SaveButton from "./SaveButton";
import RemindButton from "./RemindButton";

const PlanMap = dynamic(() => import("@/components/PlanMap"), {
  ssr: false,
  loading: () => <div className="detail-map-skel" />,
});

/** Save, remind, add to calendar and share: the client-side actions on an event page. */
export function EventActions({ event }: { event: Event }) {
  // What just happened, said on screen and to screen readers.
  const [status, setStatus] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const tell = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus((s) => (s === msg ? "" : s)), 3500);
  };

  const share = async () => {
    const url = `${window.location.origin}/events/${event.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, url });
        tell("Shared");
      } else {
        await navigator.clipboard.writeText(url);
        tell("Link copied");
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // share sheet dismissed
      try {
        await navigator.clipboard.writeText(url);
        tell("Link copied");
      } catch {
        tell("Couldn't share from this browser. Copy the address bar link instead.");
      }
    }
  };

  const downloadIcs = () => {
    const ics = planToIcs({ stops: [{ event, why: "Found on Elsewhere", travel: null }] } as unknown as PlanResult, window.location.origin);
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title.replace(/[^\w\s-]+/g, "").trim().slice(0, 60) || "event"}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setCalOpen(false);
    tell("Calendar file downloaded: open it to add the event");
  };

  return (
    <div className="detail-actions">
      <SaveButton event={event} variant="button" />
      <RemindButton event={event} />
      <div className="cal-menu">
        <button type="button" className="btn btn-ghost" aria-expanded={calOpen} onClick={() => setCalOpen((o) => !o)}>
          <CalendarPlus size={17} weight="bold" /> Add to calendar
        </button>
        {calOpen && (
          <div className="cal-pop" role="menu">
            <a
              role="menuitem"
              href={googleCalendarLink({ event, why: "Found on Elsewhere", travel: null }, typeof window === "undefined" ? "" : window.location.origin)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setCalOpen(false);
                tell("Opened Google Calendar in a new tab");
              }}
            >
              Google Calendar
            </a>
            <button type="button" role="menuitem" onClick={downloadIcs}>
              Apple, Outlook or other (.ics)
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-wa"
        onClick={() => window.open(whatsappUrl(eventShareText(event, window.location.origin)), "_blank", "noopener,noreferrer")}
      >
        <WhatsappLogo size={17} weight="fill" /> WhatsApp
      </button>
      <button type="button" className="btn btn-ghost" onClick={share}>
        {status === "Link copied" ? <Check size={17} weight="bold" /> : <ShareNetwork size={17} weight="bold" />}
        {status === "Link copied" ? "Link copied" : "Share"}
      </button>
      <p className="detail-status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

export function EventLocationMap({ event }: { event: Event }) {
  // The map library is large: load it only when the map is about to scroll
  // into view, not with the page.
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  if (event.lat == null || event.lng == null) return null;
  return (
    <div className="detail-map" ref={ref}>
      {near ? <PlanMap stops={[{ event, why: "", travel: null }]} /> : <div className="detail-map-skel" />}
      {/* The whole preview opens Elsewhere's map on this spot, with the
          event's card open and everything else on nearby. */}
      <Link
        href={`/map?event=${event.id}&lat=${event.lat}&lng=${event.lng}`}
        className="detail-map-open"
        aria-label={`Open ${event.location_name || "this place"} on the map`}
      >
        <span className="detail-map-cta">
          <MapTrifold size={16} weight="bold" aria-hidden="true" /> Open on the map
        </span>
      </Link>
    </div>
  );
}
