import { getPosterTint } from "@/lib/posterTint";

/**
 * Streams the poster colour (the backing behind the poster) into the event
 * page after it has rendered, so
 * reading the image never delays the page. Rendered inside <Suspense>.
 */
export default async function PosterTintStyle({ url, scope }: { url: string | null; scope: string }) {
  const tint = await getPosterTint(url);
  if (!tint) return null;
  const sel = `.detail[data-ev="${scope.replace(/[^a-zA-Z0-9-]/g, "")}"]`;
  // Only the poster's own frame takes its colour; type stays on the theme so
  // it reads on paper by day and on the board at night.
  const css = `${sel}{--tint-glow:${tint.glow};--tint-wash:${tint.wash}}`;
  return <style>{css}</style>;
}
