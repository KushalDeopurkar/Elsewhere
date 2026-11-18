import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

const load = (u: URL) =>
  readFile(u)
    .then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    .catch(() => null);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const num = (v: string | null) => Math.max(0, Math.min(9999, Number.parseInt(v ?? "0", 10) || 0));

/**
 * Story-sized (1080x1920) share image for the monthly recap. Everything comes
 * from the query string the recap page builds from the person's own data;
 * nothing is looked up, so it works for guests too.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const month = clip(q.get("month") ?? "This month", 12);
  const persona = clip(q.get("persona") ?? "Curious Wanderer", 26);
  const line = clip(q.get("line") ?? "", 60);
  const top = clip(q.get("top") ?? "", 24);
  const stats = [
    { n: num(q.get("saved")), l: "events saved" },
    { n: num(q.get("stamps")), l: "new stamps" },
    { n: num(q.get("going")), l: "going" },
    { n: num(q.get("nights")), l: "late nights" },
  ].filter((s) => s.n > 0).slice(0, 4);
  const [bold, text] = await Promise.all([
    load(new URL("../card/fonts/Bricolage-Bold.ttf", import.meta.url)),
    load(new URL("../card/fonts/Geist-Regular.ttf", import.meta.url)),
  ]);
  const D = bold && text ? "Bricolage" : "Geist";

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1920, display: "flex", flexDirection: "column", padding: "120px 90px 100px", background: "#0e1015", color: "#f2f3f7", fontFamily: "Geist", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(160deg, rgba(255,107,87,0.32) 0%, rgba(14,16,21,0) 42%, rgba(14,16,21,0) 62%, rgba(169,155,255,0.22) 100%)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700, fontFamily: D, position: "relative" }}>
          <div style={{ width: 22, height: 22, borderRadius: 99, background: "#ff6b57" }} />
          Elsewhere
        </div>
        <div style={{ display: "flex", marginTop: 120, fontSize: 40, letterSpacing: 6, color: "#ff8a7a", textTransform: "uppercase", position: "relative" }}>My {month}</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 132, lineHeight: 0.95, fontWeight: 700, letterSpacing: -4, fontFamily: D, position: "relative" }}>{persona}</div>
        {line && <div style={{ display: "flex", marginTop: 30, fontSize: 40, color: "#c6cad6", position: "relative" }}>{line}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28, marginTop: 100, position: "relative" }}>
          {stats.map((s) => (
            <div key={s.l} style={{ display: "flex", flexDirection: "column", width: 420, padding: "34px 38px", borderRadius: 32, background: "rgba(29,32,41,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ fontSize: 110, fontWeight: 700, fontFamily: D, lineHeight: 1 }}>{s.n}</span>
              <span style={{ fontSize: 34, color: "#c6cad6", marginTop: 8 }}>{s.l}</span>
            </div>
          ))}
        </div>
        {top && (
          <div style={{ display: "flex", marginTop: 50, fontSize: 40, color: "#c6cad6", position: "relative" }}>
            Top vibe:&nbsp;<span style={{ color: "#f2f3f7", fontWeight: 700, fontFamily: D }}>{top}</span>
          </div>
        )}
        <div style={{ display: "flex", marginTop: "auto", fontSize: 32, color: "#8e94a6", position: "relative" }}>Find yours at elsewhere-in.vercel.app</div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts:
        bold && text
          ? [
              { name: "Geist", data: text, weight: 400, style: "normal" },
              { name: "Bricolage", data: bold, weight: 700, style: "normal" },
            ]
          : undefined,
      headers: { "cache-control": "public, max-age=86400" },
    },
  );
}
