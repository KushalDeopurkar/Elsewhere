const RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type Priced = {
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  tickets?: { price: number | null; currency: string | null }[] | null;
};

export function formatRupees(n: number): string {
  return RUPEES.format(n);
}

/** Price range from ticket tiers when the listing itself has none. */
function withTiers<T extends Priced>(event: T): T {
  if (event.price_min != null || !event.tickets?.length) return event;
  const p = event.tickets.filter((t) => t.price != null && (t.currency ?? "INR") === "INR").map((t) => t.price as number);
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
