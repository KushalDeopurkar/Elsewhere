"use client";

import { useEffect } from "react";
import type { Event } from "@/lib/types";
import { stampPassport } from "@/lib/passport";

/** Opening an event page stamps the passport. Renders nothing. */
export default function PassportStamp({ event }: { event: Event }) {
  useEffect(() => {
    stampPassport(event);
    // Once per event page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);
  return null;
}
