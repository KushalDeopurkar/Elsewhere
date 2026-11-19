"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ShareNetwork, Check, WhatsappLogo } from "@phosphor-icons/react/ssr";
import { whatsappUrl, eventShareText } from "@/lib/share";
import { googleCalendarLink } from "@/lib/plan";
import type { Event } from "@/lib/types";
import SaveButton from "./SaveButton";

const PlanMap = dynamic(() => import("@/components/PlanMap"), {
  ssr: false,
  loading: () => <div className="detail-map-skel" />,
});

/** Save, add to calendar and share: the client-side actions on an event page. */
export function EventActions({ event }: { event: Event }) {
  const [shared, setShared] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/events/${event.id}`;
    try {
      if (navigator.share) await navigator.share({ title: event.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  const calendar = () => {
    window.open(
      googleCalendarLink({ event, why: "Found on Elsewhere", travel: null }, window.location.origin),
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="detail-actions">
      <SaveButton event={event} variant="button" />
      <button type="button" className="btn btn-ghost" onClick={calendar}>
        <CalendarPlus size={17} weight="bold" /> Add to calendar
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-wa"
        onClick={() => window.open(whatsappUrl(eventShareText(event, window.location.origin)), "_blank", "noopener,noreferrer")}
      >
        <WhatsappLogo size={17} weight="fill" /> WhatsApp
      </button>
      <button type="button" className="btn btn-ghost" onClick={share}>
        {shared ? <Check size={17} weight="bold" /> : <ShareNetwork size={17} weight="bold" />}
        {shared ? "Link copied" : "Share"}
      </button>
    </div>
  );
}

/** Single-pin map of the venue. */
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
    </div>
  );
}
