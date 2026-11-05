// Supabase Edge Function: embed text with gte-small (384 dims).
//
// Uses Supabase's built-in inference, so no third-party key or quota is
// involved. Deploy with JWT verification off: the site's server calls it
// with whichever key format the project has (legacy JWT or sb_secret_), and
// input is capped so it cannot be used for bulk work by anyone else.
//
// POST { "texts": ["...", "..."] }  ->  { "embeddings": [[...384 floats], ...] }

const session = new Supabase.ai.Session("gte-small");

const MAX_TEXTS = 16;
const MAX_CHARS = 2000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: 'POST { "texts": string[] }' }, 405);
  }

  let body: { texts?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  const texts = body.texts;
  if (
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > MAX_TEXTS ||
    texts.some((t) => typeof t !== "string" || t.trim() === "")
  ) {
    return json({ error: `"texts" must be 1-${MAX_TEXTS} non-empty strings` }, 400);
  }

  try {
    const embeddings: number[][] = [];
    for (const text of texts as string[]) {
      const output = await session.run(text.slice(0, MAX_CHARS), {
        mean_pool: true,
        normalize: true,
      });
      embeddings.push(Array.from(output as ArrayLike<number>));
    }
    return json({ model: "gte-small", dims: 384, embeddings });
  } catch (err) {
    return json({ error: `Embedding failed: ${(err as Error).message}` }, 500);
  }
});
