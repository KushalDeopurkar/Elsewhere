import { readFile } from "node:fs/promises";
import { OG, OG_FONTS } from "@/lib/ogTheme";
import { ImageResponse } from "next/og";
import { pollPreview } from "@/lib/pollServer";
import { clip, posterData } from "@/lib/ogImage";

/**
 * The preview a poll link shows in WhatsApp, iMessage or Instagram: who's
 * asking, the question, and the 2-3 events side by side, so friends see the
 * choice before they tap.
 */
export const runtime = "nodejs";
export const alt = "Vote on where the group goes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Votes change, but the picture only needs to be roughly current.
export const revalidate = 300;

const load = (u: URL) =>
  readFile(u)
    .then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    .catch(() => null);

// Category hues as hex (satori has no oklch).
const HUE: Record<string, string> = {
  music: "#c792ea", nightlife: "#a99bff", arts: "#ff8fb1", food: "#ffb26b", sports: "#7ee0a1", tech: "#6ec8ff",
  business: "#8fb4ff", education: "#ffd166", community: "#ff9f80", health: "#7fe3c8", outdoor: "#9ad97e", family: "#ffc46b",
};

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [poll, bold, text] = await Promise.all([
    pollPreview(id),
    load(OG_FONTS.black),
    load(new URL("../../api/card/fonts/Geist-Regular.ttf", import.meta.url)),
  ]);
  const D = bold && text ? "Archivo" : "Geist";
  const events = poll?.events.slice(0, 3) ?? [];
  const pics = await Promise.all(events.map((e) => posterData(e.image_url)));
  const n = Math.max(events.length, 1);
  const gap = 24;
  const tileW = Math.floor((1200 - 128 - gap * (n - 1)) / n);
  const question = clip(poll?.title ?? "Which one?", 56);

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: OG.board, color: OG.boardFg, fontFamily: "Geist", padding: "48px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 26, color: OG.boardFg2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: D, fontWeight: 700, color: OG.boardFg, fontSize: 30 }}>
            <div style={{ width: 16, height: 16, borderRadius: 99, background: OG.lamp }} />
            Elsewhere
          </div>
          <div style={{ display: "flex" }}>{poll ? `${clip(poll.who, 28)} asks` : "Group vote"}</div>
        </div>
        <div style={{ display: "flex", marginTop: 26, fontFamily: D, fontWeight: 700, fontSize: question.length > 34 ? 58 : 70, lineHeight: 1.04, letterSpacing: -1.5 }}>
          {question}
        </div>
        <div style={{ display: "flex", gap, marginTop: "auto" }}>
          {events.length === 0 ? (
            <div style={{ display: "flex", fontSize: 32, color: OG.boardFg2 }}>Vote on where the group goes. No account needed.</div>
          ) : (
            events.map((e, i) => (
              <div key={e.id} style={{ display: "flex", flexDirection: "column", width: tileW, borderRadius: 0, overflow: "hidden", background: OG.board2, border: `2px solid ${HUE[e.category] ?? OG.boardFg2}` }}>
                <div style={{ display: "flex", position: "relative", width: tileW, height: 210, background: HUE[e.category] ?? OG.board2 }}>
                  {pics[i] && <img src={pics[i]!} alt="" width={tileW} height={210} style={{ width: tileW, height: 210, objectFit: "cover" }} />}
                  <div style={{ position: "absolute", left: 14, top: 14, display: "flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: 99, background: OG.board, fontFamily: D, fontWeight: 700, fontSize: 26 }}>
                    {String.fromCharCode(65 + i)}
                  </div>
                </div>
                <div style={{ display: "flex", padding: "16px 18px 0", fontSize: n === 3 ? 25 : 30, lineHeight: 1.2, fontFamily: D, fontWeight: 700, height: 96, overflow: "hidden" }}>
                  {clip(e.title, n === 3 ? 36 : 52)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts:
        bold && text
          ? [
              { name: "Geist", data: text, weight: 400, style: "normal" },
              { name: "Archivo", data: bold, weight: 700, style: "normal" },
            ]
          : undefined,
    },
  );
}
