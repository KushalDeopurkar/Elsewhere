"use client";

/**
 * Product events for Vercel Web Analytics (cookieless, no personal data).
 * Page views are counted automatically; these mark the moments that tell us
 * which features get used. Values must not identify anyone: no names,
 * emails or free text. A no-op until the analytics script is on the page.
 */
type Props = Record<string, string | number | boolean | null>;

declare global {
  interface Window {
    va?: (kind: "event", payload: { name: string; data?: Props }) => void;
  }
}

export function track(name: string, data?: Props): void {
  try {
    window.va?.("event", { name, data });
  } catch {
    /* analytics must never break the page */
  }
}
