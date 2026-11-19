import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { OG, OG_FONTS } from "@/lib/ogTheme";

/** The site's own share card: the masthead on the night board, with a NOW line. */
export const runtime = "nodejs";
export const alt = "Elsewhere: everything on in your city tonight";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const load = (u: URL) =>
  readFile(u)
    .then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    .catch(() => null);

// Lines, not departures: a share image shouldn't print times nobody listed.
const ROWS = [
  ["#c792ea", "Live music", "Gigs, open mics, DJ nights"],
  ["#6ec8ff", "Workshops", "Hackathons, classes, talks"],
  ["#7ee0a1", "Matches", "Football, cricket, runs"],
];

export default async function SiteOg() {
  const [black, bold, text] = await Promise.all([load(OG_FONTS.black), load(OG_FONTS.bold), load(OG_FONTS.text)]);
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: OG.board, color: OG.boardFg, fontFamily: "Geist", padding: "56px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "ArchivoBold", fontSize: 28, letterSpacing: 1 }}>
          <div style={{ width: 16, height: 16, background: OG.lamp }} />
          ELSEWHERE
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, fontFamily: "ArchivoBlack", fontSize: 132, lineHeight: 0.86 }}>
          <span>TONIGHT</span>
          <span style={{ color: OG.boardFg2 }}>IN YOUR CITY</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 36 }}>
          <span style={{ display: "flex", padding: "4px 10px", background: OG.lamp, color: OG.board, fontFamily: "ArchivoBold", fontSize: 22, letterSpacing: 3 }}>NOW</span>
          <div style={{ display: "flex", flex: 1, height: 4, background: OG.lamp }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
          {ROWS.map(([hue, what, where]) => (
            <div key={what} style={{ display: "flex", alignItems: "center", gap: 28, padding: "12px 0", borderBottom: `1px solid ${OG.board2}` }}>
              <span style={{ display: "flex", width: 28, height: 28, background: hue }} />
              <span style={{ fontFamily: "ArchivoBold", fontSize: 30, width: 360 }}>{what}</span>
              <span style={{ fontSize: 24, color: OG.boardFg2 }}>{where}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts:
        black && bold && text
          ? [
              { name: "Geist", data: text, weight: 400, style: "normal" },
              { name: "ArchivoBold", data: bold, weight: 700, style: "normal" },
              { name: "ArchivoBlack", data: black, weight: 900, style: "normal" },
            ]
          : undefined,
    },
  );
}
