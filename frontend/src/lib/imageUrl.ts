/**
 * Event pictures come straight from ticketing sites, often as 1-2 MB posters
 * (District serves ~1000x1400 PNGs). Showing a 70px map pin from that is most
 * of a phone's data and time, so pictures go through an image resizer that
 * returns a small WebP at the size it is drawn.
 *
 * The resizer is wsrv.nl (images.weserv.nl, open source, cached on a CDN).
 * Set NEXT_PUBLIC_IMAGE_PROXY to another host with the same API, or to "off"
 * to load originals.
 */

const PROXY = (process.env.NEXT_PUBLIC_IMAGE_PROXY ?? "https://wsrv.nl").trim().replace(/\/$/, "");
export const IMAGE_PROXY_ORIGIN = PROXY && PROXY !== "off" ? PROXY : null;

/** The picture at `width` CSS pixels (doubled for sharp screens), or the original when it can't be resized. */
export function sized(src: string | null | undefined, width: number): string | null {
  if (!src) return null;
  if (!IMAGE_PROXY_ORIGIN || !/^https?:\/\//i.test(src) || /\.svg(\?|$)/i.test(src)) return src;
  if (src.startsWith(IMAGE_PROXY_ORIGIN)) return src;
  const w = Math.max(32, Math.min(1600, Math.round(width * 2)));
  return `${IMAGE_PROXY_ORIGIN}/?url=${encodeURIComponent(src)}&w=${w}&we&output=webp&q=72`;
}

/**
 * A tiny, already-blurred copy for the fill behind a picture shown whole.
 * The resizer does the blur once on its CDN; the browser just stretches a
 * 32px image, which is free. A CSS blur filter on every card made each
 * scroll frame re-rasterise dozens of blurred layers.
 */
export function blurred(src: string | null | undefined): string | null {
  if (!src || !IMAGE_PROXY_ORIGIN || !/^https?:\/\//i.test(src) || /\.svg(\?|$)/i.test(src)) return null;
  if (src.startsWith(IMAGE_PROXY_ORIGIN)) return null;
  return `${IMAGE_PROXY_ORIGIN}/?url=${encodeURIComponent(src)}&w=32&h=32&fit=cover&blur=3&we&output=webp&q=55`;
}
