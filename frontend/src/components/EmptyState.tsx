"use client";

import { Filters, DEFAULT_RADIUS_KM } from "@/lib/filters";
import { getGroup } from "@/lib/taxonomy";

/**
 * Empty results.
 *
 * Reads the active filters and offers to relax the ones actually doing the
 * narrowing, so a dead end becomes one click from a result. It never
 * fabricates placeholder events to look populated.
 */
interface Suggestion {
  label: string;
  patch: Partial<Filters>;
}

function buildSuggestions(f: Filters): Suggestion[] {
  const out: Suggestion[] = [];

  if (f.date !== "any" && f.date !== "month") {
    out.push({ label: "Widen to the next 30 days", patch: { date: "month" } });
  }
  if (f.freeOnly) {
    out.push({ label: "Include paid events", patch: { freeOnly: false } });
  }
  if (f.online === false) {
    out.push({ label: "Include online events", patch: { online: null } });
  }
  if (f.online === true) {
    out.push({ label: "Include in-person events", patch: { online: null } });
  }
  if (f.place && f.radiusKm < 100) {
    out.push({
      label: `Search within 100 km of ${f.place.label}`,
      patch: { radiusKm: 100 },
    });
  }
  if (f.place) {
    out.push({ label: "Search anywhere", patch: { place: null } });
  }
  if (f.sub) {
    const group = f.group ? getGroup(f.group) : undefined;
    out.push({
      label: group ? `Show all of ${group.label}` : "Clear subcategory",
      patch: { sub: null },
    });
  }
  if (f.group) {
    out.push({ label: "Search every category", patch: { group: null, sub: null } });
  }
  if (f.q.trim()) {
    out.push({ label: `Drop the keyword “${f.q.trim()}”`, patch: { q: "" } });
  }

  // Four is enough to be useful without becoming a wall of buttons.
  return out.slice(0, 4);
}

function describe(f: Filters): string {
  const bits: string[] = [];
  if (f.q.trim()) bits.push(`matching “${f.q.trim()}”`);
  const group = f.group ? getGroup(f.group) : undefined;
  if (group) {
    const sub = f.sub
      ? group.subcategories.find((s) => s.slug === f.sub)?.label
      : undefined;
    bits.push(`in ${sub ?? group.label}`);
  }
  if (f.freeOnly) bits.push("that are free");
  if (f.online === true) bits.push("held online");
  if (f.online === false) bits.push("held in person");
  if (f.place) {
    bits.push(
      `within ${f.radiusKm} km of ${f.place.label === "Near me" ? "you" : f.place.label}`
    );
  }
  return bits.length ? ` ${bits.join(", ")}` : "";
}

export default function EmptyState({
  filters,
  onChange,
  onReset,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
}) {
  const suggestions = buildSuggestions(filters);
  const hasAnyRefinement =
    suggestions.length > 0 || filters.radiusKm !== DEFAULT_RADIUS_KM;

  return (
    <div className="panel">
      <p className="panel-title">Nothing scheduled yet</p>
      <p className="panel-body">
        {hasAnyRefinement ? (
          <>
            No upcoming events{describe(filters)}. These events are gathered
            from public listings, so coverage varies by city and category —
            try relaxing a filter.
          </>
        ) : (
          <>
            There are no upcoming events in the index right now. Events are
            gathered from public listings on a schedule, so check back shortly.
          </>
        )}
      </p>

      {hasAnyRefinement && (
        <div className="panel-actions">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              className="button"
              onClick={() => onChange(s.patch)}
            >
              {s.label}
            </button>
          ))}
          <button type="button" className="button button-quiet" onClick={onReset}>
            Clear everything
          </button>
        </div>
      )}
    </div>
  );
}
