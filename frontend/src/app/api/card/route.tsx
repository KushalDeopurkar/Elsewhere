import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { getEvent } from "@/lib/api";
import { whenOf } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import { getCategoryColorFixed } from "@/lib/categoryColors";
import type { Event } from "@/lib/types";

export const runtime = "nodejs";

const load = (u: URL) =>
  readFile(u)
    .then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    .catch(() => null);
let fontsP: Promise<[ArrayBuffer | null, ArrayBuffer | null]> | null = null;
/** Bricolage Grotesque Bold for display, Geist for text (static TTFs; satori can't read woff2). */
function cardFonts() {
  fontsP ??= Promise.all([
    load(new URL("./fonts/Bricolage-Bold.ttf", import.meta.url)),
    load(new URL("./fonts/Geist-Regular.ttf", import.meta.url)),
  ]);
  return fontsP;
}

const SIZES = { story: [1080, 1920], square: [1080, 1080] } as const;
const MAX = { story: 5, square: 3 } as const;

/** Fetch a poster as a data URL so one bad image can't break the card. */
async function inlineImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const ctrl = AbortSignal.timeout(2500);
    const r = await fetch(url, { signal: ctrl, headers: { "user-agent": "Mozilla/5.0 Elsewhere-card" } });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !/^image\/(jpeg|png|webp|gif)/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** satori has no oklch(): convert the category colour to sRGB hex. */
function oklchHex(css: string): string {
  const m = /oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(css);
  if (!m) return "#c6cad6";
  const [L, C, H] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  return (
    "#" +
    lin
      .map((c) => {
        const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
      })
      .join("")
  );
}

/** Plain text only: satori renders text, so strip anything odd. */
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Poster-style share card for a plan or shortlist, sized for Instagram
 * Stories (story) or WhatsApp/feed (square). GET /api/card?ids=a,b&title=…&format=story
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const format = q.get("format") === "square" ? "square" : "story";
  const [W, H] = SIZES[format];
  const ids = (q.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX[format]);
  const title = clip(q.get("title")?.trim() || "My picks", 48);
  const kicker = clip(q.get("kicker")?.trim() || "Found on Elsewhere", 40);

  const events = (await Promise.all(ids.map((id) => getEvent(id)))).filter((e): e is Event => Boolean(e));
  const images = await Promise.all(events.map((e) => inlineImage(e.image_url)));
  const hero = images.find(Boolean) ?? null;
  const story = format === "story";
  const thumb = story ? 190 : 150;
  const [bold, text] = await cardFonts();
  const D = bold && text ? "Bricolage" : "Geist";

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: "#0e1015", color: "#f2f3f7", position: "relative", fontFamily: "Geist" }}>
        {hero && (
          <img src={hero} alt="" width={W} height={H} style={{ position: "absolute", inset: 0, width: W, height: H, objectFit: "cover", opacity: 0.22, filter: "blur(40px)" }} />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "radial-gradient(900px 700px at 90% 0%, rgba(255,107,87,0.35), transparent 70%), linear-gradient(to bottom, rgba(14,16,21,0.2), #0e1015 70%)" }} />
        <div style={{ display: "flex", flexDirection: "column", padding: story ? "110px 80px 90px" : "70px 70px 60px", flex: 1, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: story ? 40 : 32, fontWeight: 700, fontFamily: D }}>
            <div style={{ width: story ? 22 : 18, height: story ? 22 : 18, borderRadius: 99, background: "#ff6b57" }} />
            Elsewhere
          </div>
          <div style={{ display: "flex", marginTop: story ? 80 : 44, fontSize: story ? 34 : 26, color: "#ff8a7a", textTransform: "uppercase", letterSpacing: 4 }}>{kicker}</div>
          <div style={{ display: "flex", marginTop: 14, fontSize: story ? 96 : 70, lineHeight: 1.02, fontWeight: 700, letterSpacing: -2, fontFamily: D }}>{title}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: story ? 34 : 22, marginTop: story ? 70 : 40 }}>
            {events.map((e, i) => {
              const hue = oklchHex(getCategoryColorFixed(e.category).color);
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 28, padding: story ? 22 : 16, borderRadius: 28, background: "rgba(29,32,41,0.82)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", width: thumb, height: thumb, borderRadius: 20, overflow: "hidden", background: "#232734", flexShrink: 0, position: "relative" }}>
                    {images[i] ? (
                      <img src={images[i]!} alt="" width={thumb} height={thumb} style={{ width: thumb, height: thumb, objectFit: "cover" }} />
                    ) : (
                      <div style={{ display: "flex", width: thumb, height: thumb, background: hue, opacity: 0.4 }} />
                    )}
                    <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 99, background: "#ff6b57", color: "#2a0a05", fontSize: 26, fontWeight: 700, fontFamily: D }}>{i + 1}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", fontSize: story ? 40 : 32, fontWeight: 700, lineHeight: 1.1, fontFamily: D }}>{clip(e.title, story ? 60 : 44)}</div>
                    <div style={{ display: "flex", fontSize: story ? 28 : 22, color: "#c6cad6" }}>
                      {clip(`${whenOf(e)}${e.location_name ? ` · ${e.location_name}` : ""}`, story ? 52 : 46)}
                    </div>
                    <div style={{ display: "flex", fontSize: story ? 26 : 20, color: hue }}>{priceBadge(e)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "center", fontSize: story ? 30 : 24, color: "#8e94a6" }}>
            <span>elsewhere-in.vercel.app</span>
            {ids.length > events.length ? null : <span style={{ color: "#c6cad6" }}>{events.length} {events.length === 1 ? "pick" : "picks"}</span>}
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts:
        bold && text
          ? [
              { name: "Geist", data: text, weight: 400, style: "normal" },
              { name: "Bricolage", data: bold, weight: 700, style: "normal" },
            ]
          : undefined,
      headers: { "cache-control": "public, max-age=3600" },
    },
  );
}
