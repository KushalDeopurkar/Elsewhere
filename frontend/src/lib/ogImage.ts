/** Shared helpers for the share images (next/og). Server only. */

/**
 * Fetch a poster and return it as a data URI that satori (next/og) can draw.
 * satori reads only PNG, JPEG and GIF: a WebP or AVIF poster made it throw
 * ("u2 is not iterable", Sentry ELSEWHERE-A) and the whole image failed. The
 * format is read from the file's first bytes, not the content-type header
 * (CDNs serve WebP under a .jpg name), and anything else is converted to
 * JPEG with sharp. Returns null when there is no usable picture, so the
 * image is drawn without one.
 */
export async function inlineImage(url: string | null | undefined, agent = "Elsewhere-og"): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500), headers: { "user-agent": `Mozilla/5.0 ${agent}` } });
    if (!r.ok || !/^image\//.test(r.headers.get("content-type") ?? "")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 12 || buf.length > 4_000_000) return null;
    const kind = sniff(buf);
    if (kind) return `data:image/${kind};base64,${buf.toString("base64")}`;
    const { default: sharp } = await import("sharp");
    const jpeg = await sharp(buf, { limitInputPixels: 40_000_000 })
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

function sniff(b: Buffer): "png" | "jpeg" | "gif" | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  return null;
}

/** The same, for callers that only pass a URL (the poll image). */
export const posterData = (url: string | null) => inlineImage(url);

export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
