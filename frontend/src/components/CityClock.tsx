"use client";

import { useNow } from "@/lib/clock";
import { useCity } from "@/lib/cityPref";
import { cityZone } from "@/lib/cities";
import { zoneLabel } from "@/lib/formatDate";

const fmt = (zone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The chosen city's local time, as the timetable header prints it: "19:24 IST". */
export default function CityClock({ className }: { className?: string }) {
  const now = useNow(15_000);
  const city = useCity();
  const zone = cityZone(city);
  if (!now) return <span className={className} aria-hidden="true">--:--</span>;
  const time = fmt(zone).format(new Date(now));
  const label = zoneLabel(zone, now);
  return (
    <time className={className} dateTime={new Date(now).toISOString()} aria-label={`Time in ${city.name}: ${time} ${label}`}>
      {time}
      <span className="clock-zone">{label}</span>
    </time>
  );
}
