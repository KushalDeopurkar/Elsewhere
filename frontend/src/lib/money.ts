const RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Short price for a card badge: "Free", "Rs 499", "Rs 499+". */
export function priceBadge(event: {
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
}): string {
  if (event.is_free) return "Free";
  if (event.price_min == null) return "Tickets";
  const base = RUPEES.format(event.price_min);
  return event.price_max != null && event.price_max > event.price_min
    ? `${base}+`
    : base;
}

/** Full price line for the detail page. */
export function priceLine(event: {
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
}): string {
  if (event.is_free) return "Free entry";
  if (event.price_min == null) return "See listing";
  if (event.price_max != null && event.price_max > event.price_min) {
    return `${RUPEES.format(event.price_min)} to ${RUPEES.format(event.price_max)}`;
  }
  return RUPEES.format(event.price_min);
}
