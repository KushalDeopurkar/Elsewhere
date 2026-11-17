"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { canTransition, transitionTo, type TransitionKind } from "@/lib/transitions";

/**
 * A next/link that animates the page change. With kind="event" it looks for
 * the enclosing event card and morphs its picture into the event page.
 */
export default function TransitionLink({
  kind = "page",
  onClick,
  ...props
}: ComponentProps<typeof Link> & { kind?: TransitionKind }) {
  const router = useRouter();
  const href = typeof props.href === "string" ? props.href : (props.href.pathname ?? "/");

  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
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

  return <Link {...props} onClick={handle} />;
}
