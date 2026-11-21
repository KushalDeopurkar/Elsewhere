"use client";

/**
 * Page transitions on the browser's View Transitions API.
 *
 * Next's router.push does not return when the new page is on screen, so a
 * tiny RouteSignal in the layout calls routeCommitted() once the pathname
 * changes; the transition waits for that before animating to the new page.
 * Browsers without the API, and people who prefer reduced motion, get a
 * plain navigation.
 */

let waiters: Array<() => void> = [];

export function routeCommitted(): void {
  const w = waiters;
  waiters = [];
  w.forEach((f) => f());
}

function waitForRoute(timeout = 2500): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(t);
      resolve();
    };
    const t = setTimeout(done, timeout);
    waiters.push(done);
  });
}

export function canTransition(): boolean {
  return (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    // A hidden tab can't run a transition (the browser aborts it with an
    // InvalidStateError): just navigate.
    document.visibilityState === "visible" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export type TransitionKind = "page" | "event";

/**
 * Navigate with a transition. `shared` elements are tagged with a
 * view-transition-name for the moment of the snapshot only, so the same
 * event appearing twice on a page never collides.
 */
export function transitionTo(
  href: string,
  navigate: () => void,
  opts: { kind?: TransitionKind; shared?: { el: Element | null | undefined; name: string }[] } = {},
): void {
  const target = new URL(href, window.location.href);
  if (!canTransition() || target.pathname === window.location.pathname) {
    navigate();
    return;
  }
  const tagged = (opts.shared ?? []).filter((s): s is { el: HTMLElement; name: string } => s.el instanceof HTMLElement);
  tagged.forEach((s) => (s.el.style.viewTransitionName = s.name));
  const root = document.documentElement;
  root.dataset.vt = opts.kind ?? "page";
  const vt = document.startViewTransition(async () => {
    tagged.forEach((s) => (s.el.style.viewTransitionName = ""));
    navigate();
    await waitForRoute();
  });
  // An aborted transition (tab hidden mid-way, a second click) still
  // navigates; its promises reject, which is expected, not an error.
  vt.ready.catch(() => undefined);
  vt.updateCallbackDone.catch(() => undefined);
  vt.finished
    .catch(() => undefined)
    .finally(() => {
      delete root.dataset.vt;
    });
}
