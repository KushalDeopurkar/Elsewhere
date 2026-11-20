"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
    if (!canTransition()) return; // let Link navigate normally
    e.preventDefault();
    const card = kind === "event" ? e.currentTarget.closest(".ecard, [data-vt-card]") : null;
    transitionTo(href, () => router.push(href, { scroll: true }), {
      kind,
      shared: card ? [{ el: card.querySelector(".ecard-media .eimg, [data-vt-media]"), name: "ev-hero" }] : [],
    });
  };

  // Warm the route as soon as the pointer or focus arrives, so the click
  // has its code and data ready to paint.
  const warm = () => {
    try {
      router.prefetch(href);
    } catch {
      /* prefetch is best-effort */
    }
  };

  return (
    <Link
      {...props}
      // Event grids hold dozens of cards: warm on hover or focus instead of
      // prefetching every card that scrolls into view.
      prefetch={props.prefetch ?? (kind === "event" ? false : undefined)}
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
