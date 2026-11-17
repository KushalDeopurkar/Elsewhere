/**
 * Server-only: read an event poster's dominant colour with sharp. Cached by
 * Next's fetch cache for a day; gives up after 1.5 s so a slow image host
 * never holds up the page. Returns null on any failure.
 */
import sharp from "sharp";
import { tintPalette, type Tint } from "./tint";

export async function getPosterTint(url: string | null | undefined): Promise<Tint | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const { dominant } = await sharp(buf).resize(32, 32, { fit: "cover" }).stats();
    return tintPalette(dominant);
  } catch {
    return null;
  }
}
