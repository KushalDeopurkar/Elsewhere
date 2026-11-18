import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { getEvent } from "@/lib/api";
import { formatFull } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";

export const runtime = "nodejs";

const load = (u: URL) =>
  readFile(u)
    .then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    .catch(() => null);

async function poster(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500), headers: { "user-agent": "Mozilla/5.0 Elsewhere-ticket" } });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !/^image\/(jpeg|png|webp|gif)/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 4_000_000 ? null : `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Deterministic barcode widths from the event id, so the same stub always looks the same. */
function bars(seed: string): number[] {
  let x = 2166136261;
  for (const c of seed) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
  return Array.from({ length: 46 }, () => {
    x = Math.imul(x ^ (x >>> 15), 2246822507) >>> 0;
    return 2 + (x % 4) * 2;
  });
}

/**
 * The "I'm going" ticket stub as a 1080x1350 image for Instagram or
 * WhatsApp. It is a keepsake, not an entry pass: the footer says so.
 * GET /api/ticket?id=<event id>&name=<display name>
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("id") ?? "";
  const name = clip((q.get("name") ?? "").trim() || "A friend", 28);
  const [event, bold, text] = await Promise.all([
    getEvent(id),
    load(new URL("../card/fonts/Bricolage-Bold.ttf", import.meta.url)),
    load(new URL("../card/fonts/Geist-Regular.ttf", import.meta.url)),
  ]);
  if (!event) return new Response("Not found", { status: 404 });
  const img = await poster(event.image_url);
  const D = bold && text ? "Bricolage" : "Geist";
  const code = id.replace(/-/g, "").slice(0, 8).toUpperCase();

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, display: "flex", alignItems: "center", justifyContent: "center", background: "#0e1015", fontFamily: "Geist", position: "relative" }}>
        {img && <img src={img} alt="" width={1080} height={1350} style={{ position: "absolute", inset: 0, width: 1080, height: 1350, objectFit: "cover", opacity: 0.3, filter: "blur(40px)" }} />}
        <div style={{ display: "flex", flexDirection: "column", width: 820, borderRadius: 36, background: "#f4efe6", color: "#14161c", overflow: "hidden", boxShadow: "0 40px 120px rgba(0,0,0,0.6)", position: "relative" }}>
          <div style={{ display: "flex", height: 430, position: "relative", background: "#1d2029" }}>
            {img && <img src={img} alt="" width={820} height={430} style={{ width: 820, height: 430, objectFit: "cover" }} />}
            <div style={{ position: "absolute", left: 36, top: 32, display: "flex", padding: "8px 18px", borderRadius: 99, background: "#ff6b57", color: "#2a0a05", fontSize: 24, fontWeight: 700, fontFamily: D, letterSpacing: 2 }}>
              I&apos;M GOING
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "40px 48px 30px" }}>
            <div style={{ display: "flex", fontSize: 24, letterSpacing: 6, color: "#e5533f", fontWeight: 700, fontFamily: D }}>ADMIT ONE · {name.toUpperCase()}</div>
            <div style={{ display: "flex", fontSize: event.title.length > 42 ? 50 : 60, lineHeight: 1.04, fontWeight: 700, letterSpacing: -1.5, fontFamily: D }}>{clip(event.title, 80)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 28, color: "#3a3f4d" }}>
              <span>{formatFull(event.start_time)}</span>
              <span>{clip(event.location_name || event.city || "", 48)}</span>
            </div>
          </div>
          {/* Perforation */}
          <div style={{ display: "flex", alignItems: "center", position: "relative", height: 40 }}>
            <div style={{ position: "absolute", left: -24, width: 48, height: 48, borderRadius: 99, background: "#0e1015" }} />
            <div style={{ display: "flex", flex: 1, margin: "0 40px", borderTop: "4px dashed #c9c2b4" }} />
            <div style={{ position: "absolute", right: -24, width: 48, height: 48, borderRadius: 99, background: "#0e1015" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 48px 40px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 22, color: "#6b7080", letterSpacing: 3 }}>ENTRY</span>
              <span style={{ fontSize: 34, fontWeight: 700, fontFamily: D }}>{priceBadge(event)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 70 }}>
                {bars(id).map((w, i) => (
                  <div key={i} style={{ width: w, height: i % 7 === 0 ? 70 : 58, background: "#14161c" }} />
                ))}
              </div>
              <span style={{ fontSize: 20, color: "#6b7080", letterSpacing: 4 }}>ELSEWHERE · {code}</span>
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 40, display: "flex", fontSize: 24, color: "#8e94a6" }}>
          A keepsake from elsewhere-in.vercel.app, not an entry pass
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
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
