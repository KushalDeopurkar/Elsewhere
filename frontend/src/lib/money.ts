const RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type Priced = {
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  tickets?: { price: number | null; currency: string | null; available?: boolean | null }[] | null;
};

export function formatRupees(n: number): string {
  return RUPEES.format(n);
}

/**
 * Price range from the ticket tiers when the event has them: the tiers are
 * read from the event's own page, so they beat the listing's single price
 * (which often only carries the cheapest tier).
 */
function withTiers<T extends Priced>(event: T): T {
  if (!event.tickets?.length) return event;
  const p = event.tickets
    .filter((t) => t.price != null && (t.currency ?? "INR") === "INR" && (t as { available?: boolean | null }).available !== false)
    .map((t) => t.price as number);
  if (!p.length) return event;
  const lo = Math.min(...p);
  const hi = Math.max(...p);
  return { ...event, price_min: lo, price_max: hi > lo ? hi : null, is_free: event.is_free || hi === 0 };
}

/** Short price for a card badge: "Free", "Rs 499", "Rs 499+". */
export function priceBadge(input: Priced): string {
  const event = withTiers(input);
  if (event.is_free) return "Free";
  if (event.price_min == null) return "Tickets";
  const base = RUPEES.format(event.price_min);
  return event.price_max != null && event.price_max > event.price_min
    ? `${base}+`
    : base;
}

/** Full price line for the detail page. */
export function priceLine(input: Priced): string {
  const event = withTiers(input);
  if (event.is_free) return "Free entry";
  if (event.price_min == null) return "See listing";
  if (event.price_max != null && event.price_max > event.price_min) {
    return `${RUPEES.format(event.price_min)} to ${RUPEES.format(event.price_max)}`;
  }
  return RUPEES.format(event.price_min);
}

const norm = (s: string) => s.toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Real ticket tiers only. Some sources list the event's own name as an
 * "offer"; that is not a tier. (The backend filters this too; this guards
 * rows stored before that fix.)
 */
export function realTiers<T extends { name: string }>(tickets: T[] | null | undefined, title: string): T[] {
  const t = norm(title);
  return (tickets ?? []).filter((x) => {
    const n = norm(x.name);
    return n && n !== t && !(n.length >= 8 && (t.includes(n) || n.includes(t)));
  });
}
