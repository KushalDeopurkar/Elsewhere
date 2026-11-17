/**
 * Some stored listings carry HTML entities from the source page
 * ("Finance &amp; Tech"). New scrapes are decoded at ingest; this cleans
 * rows already in the database.
 */
const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", "#39": "'" };
export function decodeEntities(s: string): string {
  let out = s;
  for (let i = 0; i < 2 && out.includes("&"); i++) {
    out = out.replace(/&(amp|quot|apos|lt|gt|nbsp|#39|#x27|#\d+);/g, (m, k: string) => {
      if (ENTITIES[k]) return ENTITIES[k];
      if (k === "#x27") return "'";
      if (k.startsWith("#")) return String.fromCharCode(Number(k.slice(1)));
      return m;
    });
  }
  return out;
}

/** Decode entities in the text fields of event-like rows from the database. */
export function decodeRows<T>(data: T): T {
  const fix = (r: unknown) => {
    if (!r || typeof r !== "object") return r;
    const o = r as Record<string, unknown>;
    for (const k of ["title", "description", "location_name"]) {
      if (typeof o[k] === "string" && (o[k] as string).includes("&")) o[k] = decodeEntities(o[k] as string);
    }
    return o;
  };
  return (Array.isArray(data) ? data.map(fix) : fix(data)) as T;
}
