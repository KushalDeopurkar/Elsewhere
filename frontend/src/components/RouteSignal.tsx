"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { routeCommitted } from "@/lib/transitions";

/** Tells a pending page transition that the new route is on screen. */
export default function RouteSignal() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    routeCommitted();
  }, [pathname]);
  return null;
}
