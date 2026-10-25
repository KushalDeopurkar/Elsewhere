/**
 * Join venue, address and city into one line without repeating anything.
 *
 * Sources routinely return overlapping fields — Eventbrite's
 * `localized_address_display` usually already contains the venue and the
 * city — which would otherwise render as "IIT Bombay, IIT Bombay, Mumbai,
 * Mumbai". Any part wholly contained in another is dropped, keeping the most
 * complete version.
 */
export function joinPlaceParts(parts: (string | null | undefined)[]): string | null {
  const present = parts
    .map((p) => p?.trim())
    .filter((p): p is string => !!p);

  const kept = present.filter((part, i) => {
    const needle = part.toLowerCase();
    return !present.some((other, j) => {
      if (i === j) return false;
      const hay = other.toLowerCase();
      if (!hay.includes(needle)) return false;
      // When two parts are identical, keep only the first occurrence.
      return hay !== needle || j < i;
    });
  });

  return kept.length ? kept.join(", ") : null;
}
