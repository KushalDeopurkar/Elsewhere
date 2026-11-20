const RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type Priced = {
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  country?: string | null;
  tickets?: { price: number | null; currency: string | null; available?: boolean | null }[] | null;
};

export function formatRupees(n: number): string {
  return RUPEES.format(n);
}

// Listing prices carry no currency of their own: it's the event's country's.
const CURRENCY: Record<string, string> = {
  IN: "INR", US: "USD", CA: "CAD", MX: "MXN", GB: "GBP", IE: "EUR", FR: "EUR", DE: "EUR", NL: "EUR",
  ES: "EUR", BE: "EUR", AT: "EUR", IT: "EUR", PT: "EUR", FI: "EUR", DK: "DKK", SE: "SEK", NO: "NOK",
  CH: "CHF", PL: "PLN", AU: "AUD", NZ: "NZD", SG: "SGD", AE: "AED", JP: "JPY",
};
export const currencyOf = (e: { country?: string | null }): string => CURRENCY[(e.country ?? "IN").toUpperCase()] ?? "USD";

const money = new Map<string, Intl.NumberFormat>();
function formatter(currency: string): Intl.NumberFormat {
  if (currency === "INR") return RUPEES;
  let f = money.get(currency);
  if (!f) {
    // Whole units read cleanly on cards ("$45", "£20", "€12").
    f = new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 });
    money.set(currency, f);
  }
  return f;
}

/** A price in the event's own currency. */
export const formatPrice = (n: number, e: { country?: string | null }) => formatter(currencyOf(e)).format(n);

/**
 * Price range from the ticket tiers when the event has them: the tiers are
 * read from the event's own page, so they beat the listing's single price
 * (which often only carries the cheapest tier).
 */
function withTiers<T extends Priced>(event: T): T {
  if (!event.tickets?.length) return event;
  const p = event.tickets
    .filter((t) => t.price != null && (t.currency ?? currencyOf(event)) === currencyOf(event) && (t as { available?: boolean | null }).available !== false)
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
  if (event.price_min == null) return "Check price";
  const base = formatPrice(event.price_min, event);
  return event.price_max != null && event.price_max > event.price_min
    ? `${base}+`
    : base;
}

/** Full price line for the detail page. */
export function priceLine(input: Priced): string {
  const event = withTiers(input);
  if (event.is_free) return "Free entry";
  if (event.price_min == null) return "Check price";
  if (event.price_max != null && event.price_max > event.price_min) {
    return `${formatPrice(event.price_min, event)} to ${formatPrice(event.price_max, event)}`;
  }
  return formatPrice(event.price_min, event);
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

/** "Cheap" in a country's money, and its symbol: ₹500 in India, about 20 elsewhere. */
export function cheapIn(country: string | null | undefined): { symbol: string; cheap: number } {
  const currency = currencyOf({ country });
  const symbol = formatter(currency).formatToParts(0).find((p) => p.type === "currency")?.value ?? "";
  const cheap = currency === "INR" ? 500 : currency === "JPY" ? 3000 : ["SEK", "NOK", "DKK", "MXN"].includes(currency) ? 200 : 20;
  return { symbol, cheap };
}

export type TicketState = "sold_out" | "closed" | "on_sale" | "unknown";

/**
 * What the listing says about getting in, honestly: sold out (every tier
 * marked sold out, or the title says so), closed (every tier's sales have
 * ended), on sale (a tier is marked available), or unknown (nothing said).
 */
export function ticketState(
  e: { title: string; is_free?: boolean; tickets?: { available?: boolean | null; sales_end?: string | null }[] | null },
  now = Date.now(),
): TicketState {
  if (/\bsold[\s-]?out\b/i.test(e.title)) return "sold_out";
  const tiers = e.tickets ?? [];
  if (!tiers.length) return "unknown";
  if (tiers.every((t) => t.available === false)) return "sold_out";
  const open = tiers.filter((t) => t.available !== false);
  if (open.length && open.every((t) => t.sales_end && Date.parse(t.sales_end) < now)) return "closed";
  if (open.some((t) => t.available === true)) return "on_sale";
  return "unknown";
}
