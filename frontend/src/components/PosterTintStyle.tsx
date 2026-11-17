import { getPosterTint } from "@/lib/posterTint";

/**
 * Streams the poster colour into the event page after it has rendered, so
 * reading the image never delays the page. Rendered inside <Suspense>.
 */
export default async function PosterTintStyle({ url, scope }: { url: string | null; scope: string }) {
  const tint = await getPosterTint(url);
  if (!tint) return null;
  const sel = `.detail[data-ev="${scope.replace(/[^a-zA-Z0-9-]/g, "")}"]`;
  const css =
    `${sel}{--tint-glow:${tint.glow};--tint-wash:${tint.wash};--tint-accent:${tint.accent}}` +
    `${sel} .detail-media{border-color:${tint.wash};box-shadow:0 40px 90px -40px ${tint.glow}}` +
    `${sel} .detail-kicker,${sel} .detail-kicker svg{color:${tint.accent}}`;
  return <style>{css}</style>;
}
