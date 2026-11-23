import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { OG, OG_FONTS, brandMark } from "@/lib/ogTheme";
import { SITE_URL } from "@/lib/site";

/**
 * The site's share card (LinkedIn, WhatsApp, X), drawn like the home hero:
 * the contour map behind a soft glow, "Where to be in your city" on the
 * left, a departures card on the right. The card lists lines, not times:
 * a share image shouldn't advertise departures nobody listed.
 */
export const runtime = "nodejs";
export const alt = "Elsewhere: where to be in your city. Workshops, gigs, matches, meetups and exhibitions, on one board.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const load = (u: URL) =>
  readFile(u)
    .then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    .catch(() => null);

/** The brand mark (components/BrandMark.tsx), as an image satori can draw. */
const MARK = brandMark();

/** A contour SVG from /public/bg, recoloured, as a data URI satori can draw. */
const contours = (file: string, stroke: string) =>
  readFile(new URL(`../../public/bg/${file}`, import.meta.url), "utf8")
    .then((svg) => `data:image/svg+xml;base64,${Buffer.from(svg.replace('stroke="#000"', `stroke="${stroke}"`)).toString("base64")}`)
    .catch(() => null);

const ROWS: [string, string, string][] = [
  ["#6ec8ff", "Learn and build", "Workshops, hackathons, talks"],
  ["#f2b867", "Meet people", "Meetups, clubs, volunteering"],
  ["#c792ea", "Go out", "Gigs, comedy, exhibitions"],
  ["#7fd8a4", "Get moving", "Runs, matches, yoga"],
];

const tile = (ch: string, i: number, lamp = false) => (
  <span
    key={i}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: ch === " " ? 12 : 30,
      height: 40,
      marginRight: 4,
      background: ch === " " ? "transparent" : OG.board,
      color: lamp ? OG.lamp : OG.boardFg,
      fontFamily: "ArchivoBold",
      fontSize: 26,
      borderRadius: 3,
    }}
  >
    {ch}
  </span>
);

export default async function SiteOg() {
  const [black, bold, text, lines, index] = await Promise.all([
    load(OG_FONTS.black),
    load(OG_FONTS.bold),
    load(OG_FONTS.text),
    contours("contours.svg", "rgba(243,240,231,0.10)"),
    contours("contours-index.svg", "rgba(252,215,38,0.13)"),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          position: "relative",
          background: OG.board,
          color: OG.boardFg,
          fontFamily: "Geist",
        }}
      >
        {lines && <img src={lines} width={1200} height={750} style={{ position: "absolute", top: -60, left: 0 }} alt="" />}
        {index && <img src={index} width={1200} height={750} style={{ position: "absolute", top: -60, left: 0 }} alt="" />}
        {/* The hero's glows: signal behind the board, violet low left */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "radial-gradient(ellipse 520px 420px at 900px 300px, rgba(252,215,38,0.16), rgba(10,21,42,0) 70%), radial-gradient(ellipse 460px 380px at 60px 600px, rgba(199,146,234,0.16), rgba(10,21,42,0) 70%)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", width: 640, padding: "56px 0 52px 64px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: "ArchivoBold", fontSize: 28, letterSpacing: 4 }}>
            <img src={MARK} width={44} height={44} alt="" />
            ELSEWHERE
          </div>
          <div style={{ display: "flex", marginTop: 40 }}>
            <span style={{ display: "flex", padding: "5px 12px", background: OG.signal, color: OG.board, fontFamily: "ArchivoBold", fontSize: 20, letterSpacing: 3 }}>
              EVERY KIND OF EVENT
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 22, fontFamily: "ArchivoBlack", fontSize: 108, lineHeight: 0.88 }}>
            <span>WHERE TO BE</span>
            <span style={{ color: OG.boardFg2 }}>IN YOUR CITY</span>
          </div>
          <div style={{ display: "flex", marginTop: 30, fontSize: 27, lineHeight: 1.35, color: OG.boardFg2, width: 540 }}>
            Workshops, gigs, matches, meetups and exhibitions, gathered from across the web onto one board.
          </div>
          <div style={{ display: "flex", marginTop: "auto", fontFamily: "ArchivoBold", fontSize: 22, color: OG.signal, letterSpacing: 1 }}>
            {new URL(SITE_URL).host}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "absolute",
            right: 56,
            top: 92,
            width: 460,
            padding: "26px 26px 18px",
            background: "rgba(21,34,59,0.92)",
            border: "1px solid rgba(243,240,231,0.18)",
            borderRadius: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "ArchivoBold", fontSize: 15, letterSpacing: 3, color: OG.signal }}>DEPARTURES</span>
              <div style={{ display: "flex", marginTop: 8 }}>{[..."NEXT UP"].map((c, i) => tile(c, i))}</div>
            </div>
            <div style={{ display: "flex" }}>{[..."NOW"].map((c, i) => tile(c, i, true))}</div>
          </div>
          <div style={{ display: "flex", marginTop: 20, gap: 8 }}>
            {["Today", "Tomorrow", "Weekend"].map((t, i) => (
              <span
                key={t}
                style={{
                  display: "flex",
                  padding: "7px 16px",
                  borderRadius: 999,
                  fontFamily: "ArchivoBold",
                  fontSize: 17,
                  background: i === 0 ? OG.signal : "transparent",
                  color: i === 0 ? OG.board : OG.boardFg2,
                  border: `1px solid ${i === 0 ? OG.signal : "rgba(243,240,231,0.22)"}`,
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
            {ROWS.map(([hue, what, where]) => (
              <div key={what} style={{ display: "flex", alignItems: "center", gap: 18, padding: "13px 0", borderBottom: "1px solid rgba(243,240,231,0.12)" }}>
                <span style={{ display: "flex", width: 40, height: 40, borderRadius: 3, background: OG.board, alignItems: "center", justifyContent: "center" }}>
                  <span style={{ display: "flex", width: 16, height: 16, borderRadius: 999, background: hue }} />
                </span>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontFamily: "ArchivoBold", fontSize: 23 }}>{what}</span>
                  <span style={{ fontSize: 17, color: OG.boardFg2, marginTop: 2 }}>{where}</span>
                </div>
              </div>
            ))}
          </div>
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
