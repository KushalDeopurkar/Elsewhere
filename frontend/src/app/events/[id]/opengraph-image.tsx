import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { loadEvent } from "@/lib/eventServer";
import { eventZone } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import { OG, OG_FONTS, brandMark } from "@/lib/ogTheme";
import { inlineImage } from "@/lib/ogImage";
import { CATEGORIES } from "@/lib/types";

/**
 * The preview people see when an event link is shared on WhatsApp,
 * Instagram DMs or X: a ticket on the night board. The poster on the right,
 * the date and time set large, the title, the place and the price.
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

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, black, bold, text] = await Promise.all([
    loadEvent(id),
    load(OG_FONTS.black),
    load(OG_FONTS.bold),
    load(OG_FONTS.text),
  ]);
  const img = await inlineImage(event?.image_url);
  const fonts = black && bold && text;
  const title = event ? clip(event.title, 72) : "Every kind of event in your city";
  const zone = event ? eventZone(event) : "Asia/Kolkata";
  const at = event ? new Date(event.start_time) : null;
  const part = (o: Intl.DateTimeFormatOptions) => (at ? new Intl.DateTimeFormat("en-GB", { timeZone: zone, ...o }).format(at) : "");
  const day = part({ day: "2-digit" });
  const mon = `${part({ weekday: "short" })} ${part({ month: "short" })}`.toUpperCase();
  const time = part({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const where = event?.location_name ? clip(event.location_name, 40) : (event?.city ?? "");
  const line = event ? (CATEGORIES.find((c) => c.value === event.category)?.label ?? "") : "";
  const textW = img ? 720 : 1072;

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: OG.board, color: OG.boardFg, fontFamily: "Geist", padding: 64, gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", width: textW, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: "ArchivoBold", fontSize: 30, letterSpacing: 1 }}>
            <img src={brandMark()} width={34} height={34} alt="" />
            ELSEWHERE
            {line ? <span style={{ marginLeft: 12, fontFamily: "Geist", fontSize: 22, color: OG.boardFg2, letterSpacing: 3 }}>{line.toUpperCase()}</span> : null}
          </div>
          <div style={{ display: "flex", fontFamily: "ArchivoBold", fontSize: title.length > 44 ? 58 : 72, lineHeight: 1.0, letterSpacing: -1 }}>{title}</div>
          {event ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 36, borderTop: `2px dashed ${OG.boardFg2}`, paddingTop: 24 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 20, color: OG.boardFg2, letterSpacing: 3 }}>{mon}</span>
                <span style={{ fontFamily: "ArchivoBlack", fontSize: 96, lineHeight: 0.9, color: OG.lamp }}>{day}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 20, color: OG.boardFg2, letterSpacing: 3 }}>DEPARTS</span>
                <span style={{ fontFamily: "ArchivoBlack", fontSize: 96, lineHeight: 0.9, color: OG.lamp }}>{time}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: "auto", alignItems: "flex-end" }}>
                <span style={{ display: "flex", padding: "8px 16px", background: OG.lamp, color: OG.board, fontFamily: "ArchivoBold", fontSize: 28 }}>{priceBadge(event)}</span>
                {where ? <span style={{ fontSize: 24, color: OG.boardFg2 }}>{where}</span> : null}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 28, color: OG.boardFg2 }}>Gigs, workshops, matches and meetups, soonest first.</div>
          )}
        </div>
        {img && (
          <div style={{ display: "flex", width: 368, height: 502, border: `4px solid ${OG.boardFg}`, overflow: "hidden" }}>
            <img src={img} alt="" width={368} height={502} style={{ width: 368, height: 502, objectFit: "cover" }} />
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: fonts
        ? [
            { name: "Geist", data: text, weight: 400, style: "normal" },
            { name: "ArchivoBold", data: bold, weight: 700, style: "normal" },
            { name: "ArchivoBlack", data: black, weight: 900, style: "normal" },
          ]
        : undefined,
    },
  );
}
