"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import type { ComponentProps, MouseEvent } from "react";
import { canTransition, transitionTo, type TransitionKind } from "@/lib/transitions";
import { rememberPreview, type EventPreview } from "@/lib/eventPreview";

/**
 * A next/link that animates the page change. With kind="event" it looks for
 * the enclosing event card and morphs its picture into the event page.
 */
export default function TransitionLink({
  kind = "page",
  preview,
  onClick,
  ...props
}: ComponentProps<typeof Link> & { kind?: TransitionKind; preview?: EventPreview }) {
  const router = useRouter();
  const href = typeof props.href === "string" ? props.href : (props.href.pathname ?? "/");

  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (preview) rememberPreview(preview);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (props.target && props.target !== "_self") return;
    // Event pages open with a plain navigation: their loading shell is
    // prefetched, so it paints on the next frame. A view transition would
    // freeze the old page on screen until the new one commits (the pause
    // people noticed), so it is kept for page-to-page moves only.
    if (kind === "event" || !canTransition()) return; // let Link navigate normally
    e.preventDefault();
    transitionTo(href, () => router.push(href, { scroll: true }), { kind });
  };

  // Warm the route as soon as the pointer or focus arrives, so the click
  // has its code and data ready to paint.
  const warm = () => {
    try {
      // Event pages: fetch the whole page, data included, so the click opens it
      // at once. Other pages: the default (layout and loading state).
      if (kind === "event") router.prefetch(href, { kind: "full" as PrefetchKind });
      else router.prefetch(href);
    } catch {
      /* prefetch is best-effort */
    }
  };

  return (
    <Link
      {...props}
      // Default prefetch: as a card scrolls into view Next fetches only the
      // event page's loading shell (cheap, cached), so a click paints at once.
      // Hover or focus then fetches the whole page (warm, below).
      onClick={handle}
      onPointerEnter={(e) => {
        props.onPointerEnter?.(e);
        warm();
      }}
      onFocus={(e) => {
        props.onFocus?.(e);
        warm();
      }}
    />
  );
}
