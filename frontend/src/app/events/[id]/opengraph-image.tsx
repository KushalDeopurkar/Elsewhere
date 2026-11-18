import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { getEvent } from "@/lib/api";
import { formatFull } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";

/**
 * The preview people see when an event link is shared on WhatsApp,
 * Instagram DMs or X: the poster, title, time, place and price on the
 * Elsewhere look, instead of a bare scraped poster.
 */
export const runtime = "nodejs";
export const alt = "Event on Elsewhere";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const load = (u: URL) =>
  readFile(u)
    .then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    .catch(() => null);

async function poster(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500), headers: { "user-agent": "Mozilla/5.0 Elsewhere-og" } });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !/^image\/(jpeg|png|webp|gif)/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, bold, text] = await Promise.all([
    getEvent(id),
    load(new URL("../../api/card/fonts/Bricolage-Bold.ttf", import.meta.url)),
    load(new URL("../../api/card/fonts/Geist-Regular.ttf", import.meta.url)),
  ]);
  const img = await poster(event?.image_url ?? null);
  const D = bold && text ? "Bricolage" : "Geist";
  const title = event ? clip(event.title, 70) : "Find your next reason to show up";
  const when = event ? formatFull(event.start_time) : "";
  const where = event?.location_name ? clip(event.location_name, 40) : event?.city ?? "";

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: "#0e1015", color: "#f2f3f7", fontFamily: "Geist", position: "relative" }}>
        {img && (
          <img src={img} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover", opacity: 0.25, filter: "blur(36px)" }} />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(90deg, #0e1015 35%, rgba(14,16,21,0.55))" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 0 56px 64px", width: img ? 700 : 1100, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700, fontFamily: D }}>
            <div style={{ width: 18, height: 18, borderRadius: 99, background: "#ff6b57" }} />
            Elsewhere
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontSize: title.length > 40 ? 54 : 66, lineHeight: 1.04, fontWeight: 700, letterSpacing: -1.5, fontFamily: D }}>{title}</div>
            {event && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 28, color: "#c6cad6" }}>
                <span>{when}</span>
                {where && <span>{where}</span>}
              </div>
            )}
          </div>
          {event && (
            <div style={{ display: "flex", alignSelf: "flex-start", padding: "10px 22px", borderRadius: 99, background: "#ff6b57", color: "#2a0a05", fontSize: 28, fontWeight: 700, fontFamily: D }}>
              {priceBadge(event)}
            </div>
          )}
        </div>
        {img && (
          <div style={{ display: "flex", position: "absolute", right: 64, top: 56, width: 400, height: 518, borderRadius: 28, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
            <img src={img} alt="" width={400} height={518} style={{ width: 400, height: 518, objectFit: "cover" }} />
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts:
        bold && text
          ? [
              { name: "Geist", data: text, weight: 400, style: "normal" },
              { name: "Bricolage", data: bold, weight: 700, style: "normal" },
            ]
          : undefined,
    },
  );
}
