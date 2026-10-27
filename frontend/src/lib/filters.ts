import { EventCategory, EventSort, SearchParams } from "./types";
import { getGroup } from "./taxonomy";

/**
 * The single source of truth for discovery state.
 *
 * Every field maps onto a parameter the search API actually implements, and
 * the whole object round-trips through the URL so any view is shareable and
 * survives a reload or a back-navigation.
 */
export type DatePreset = "any" | "today" | "tomorrow" | "weekend" | "week" | "month";

export interface PlaceSelection {
  label: string;
  lat: number;
  lng: number;
}

/** Grid is image-led and browsable; list is dense and scannable. */
export type ViewMode = "grid" | "list";

export interface Filters {
  q: string;
  /** Taxonomy group slug, not a raw enum value — resolved on the way out. */
  group: string | null;
  /** Subcategory slug within the selected group. */
  sub: string | null;
  date: DatePreset;
  /**
   * A single calendar day (YYYY-MM-DD) picked from the date strip. Takes
   * precedence over `date` — choosing an exact day is a more specific
   * intent than any preset window.
   */
  day: string | null;
  view: ViewMode;
  freeOnly: boolean;
  /** null = any format, true = online only, false = in person only. */
  online: boolean | null;
  place: PlaceSelection | null;
  radiusKm: number;
  sort: EventSort;
}

export const DEFAULT_RADIUS_KM = 25;

export const EMPTY_FILTERS: Filters = {
  q: "",
  group: null,
  sub: null,
  date: "any",
  day: null,
  view: "grid",
  freeOnly: false,
  online: null,
  place: null,
  radiusKm: DEFAULT_RADIUS_KM,
  sort: "relevance",
};

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "any", label: "Any date" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "This weekend" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "Next 30 days" },
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Resolve a preset to a concrete window in the user's own timezone.
 *
 * `from` is clamped to "now" for windows that include today, so a preset
 * never surfaces events that already started this morning. The API defaults
 * from_time to now anyway; being explicit keeps the two ends consistent.
 */
export function resolveDateRange(
  preset: DatePreset,
  now: Date = new Date()
): { from?: string; to?: string } {
  const today = startOfDay(now);

  switch (preset) {
    case "today":
      return { from: now.toISOString(), to: addDays(today, 1).toISOString() };
    case "tomorrow":
      return {
        from: addDays(today, 1).toISOString(),
        to: addDays(today, 2).toISOString(),
      };
    case "weekend": {
      // Saturday 00:00 → Monday 00:00. On Sat/Sun this means "the rest of
      // this weekend" rather than jumping forward a week.
      const day = now.getDay(); // 0 Sun … 6 Sat
      const daysUntilSat = (6 - day + 7) % 7;
      const satStart = addDays(today, daysUntilSat);
      const monStart = addDays(satStart, 2);
      const from = day === 0 ? now : satStart < now ? now : satStart;
      const to = day === 0 ? addDays(today, 1) : monStart;
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case "week":
      return { from: now.toISOString(), to: addDays(today, 8).toISOString() };
    case "month":
      return { from: now.toISOString(), to: addDays(today, 31).toISOString() };
    case "any":
    default:
      return {};
  }
}

/**
 * Window for one calendar day in the user's own timezone. Clamped to "now"
 * when that day is today, so the strip never surfaces events that already
 * started this morning.
 */
export function resolveDay(
  day: string,
  now: Date = new Date()
): { from?: string; to?: string } {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return {};
  const start = new Date(y, m - 1, d);
  const end = addDays(start, 1);
  const from = start < now && end > now ? now : start;
  return { from: from.toISOString(), to: end.toISOString() };
}

/** YYYY-MM-DD in local time — `toISOString` would shift across timezones. */
export function toDayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** True when anything is set that should switch the home view to results. */
export function hasActiveFilters(f: Filters): boolean {
  return (
    f.q.trim() !== "" ||
    f.group !== null ||
    f.sub !== null ||
    f.date !== "any" ||
    f.day !== null ||
    f.freeOnly ||
    f.online !== null ||
    f.place !== null
  );
}

/** How many refinements are active — drives the filter button's badge. */
export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.group) n += 1;
  if (f.sub) n += 1;
  if (f.date !== "any" || f.day) n += 1;
  if (f.freeOnly) n += 1;
  if (f.online !== null) n += 1;
  if (f.place) n += 1;
  return n;
}

/**
 * Translate discovery state into API parameters.
 *
 * A subcategory's keyword is combined with the user's typed query; both feed
 * the same full-text parameter, which the backend ANDs — that is the intended
 * narrowing behaviour.
 */
export function toSearchParams(
  f: Filters,
  opts: { limit?: number; offset?: number; now?: Date } = {}
): SearchParams {
  const group = f.group ? getGroup(f.group) : undefined;
  const subcategory = group && f.sub
    ? group.subcategories.find((s) => s.slug === f.sub)
    : undefined;

  const resolved = subcategory?.query ?? group?.query ?? {};
  const terms = [f.q.trim(), resolved.q].filter((t): t is string => !!t);
  const { from, to } = f.day
    ? resolveDay(f.day, opts.now)
    : resolveDateRange(f.date, opts.now);

  // Distance sorting is only meaningful with an origin point.
  const sort: EventSort = f.sort === "distance" && !f.place ? "date" : f.sort;

  return {
    q: terms.length ? terms.join(" ") : undefined,
    category: resolved.category as EventCategory | undefined,
    lat: f.place?.lat,
    lng: f.place?.lng,
    radius_km: f.place ? f.radiusKm : undefined,
    from_time: from,
    to_time: to,
    free_only: f.freeOnly ? true : undefined,
    online_only: f.online ?? undefined,
    sort_by: sort,
    limit: opts.limit,
    offset: opts.offset,
  };
}

// ---------------------------------------------------------------------------
// URL serialisation. Only non-default values are written, so a plain
// discovery view keeps a clean `/` URL.
// ---------------------------------------------------------------------------

export function filtersToQueryString(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.group) p.set("group", f.group);
  if (f.sub) p.set("sub", f.sub);
  if (f.day) p.set("day", f.day);
  else if (f.date !== "any") p.set("date", f.date);
  if (f.view !== "grid") p.set("view", f.view);
  if (f.freeOnly) p.set("free", "1");
  if (f.online !== null) p.set("format", f.online ? "online" : "in-person");
  if (f.place) {
    p.set("place", f.place.label);
    p.set("ll", `${f.place.lat.toFixed(4)},${f.place.lng.toFixed(4)}`);
    if (f.radiusKm !== DEFAULT_RADIUS_KM) p.set("radius", String(f.radiusKm));
  }
  if (f.sort !== "relevance") p.set("sort", f.sort);
  return p.toString();
}

const DATE_VALUES = new Set<string>(DATE_PRESETS.map((d) => d.value));
const SORT_VALUES = new Set<string>(["relevance", "date", "distance"]);

export function filtersFromSearchParams(
  params: URLSearchParams | ReadonlyURLSearchParamsLike
): Filters {
  const get = (k: string) => params.get(k);

  const groupSlug = get("group");
  const group = groupSlug ? getGroup(groupSlug) : undefined;
  const subSlug = get("sub");
  const sub = group && subSlug
    ? group.subcategories.find((s) => s.slug === subSlug)?.slug ?? null
    : null;

  const dateRaw = get("date") ?? "any";
  const date = (DATE_VALUES.has(dateRaw) ? dateRaw : "any") as DatePreset;

  const format = get("format");
  const online = format === "online" ? true : format === "in-person" ? false : null;

  let place: PlaceSelection | null = null;
  const ll = get("ll");
  const label = get("place");
  if (ll && label) {
    const [latRaw, lngRaw] = ll.split(",");
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      place = { label, lat, lng };
    }
  }

  const radiusRaw = Number(get("radius"));
  const sortRaw = get("sort") ?? "relevance";

  const dayRaw = get("day");
  const day = dayRaw && /^\d{4}-\d{2}-\d{2}$/.test(dayRaw) ? dayRaw : null;
  const view: ViewMode = get("view") === "list" ? "list" : "grid";

  return {
    q: get("q") ?? "",
    group: group?.slug ?? null,
    sub,
    date,
    day,
    view,
    freeOnly: get("free") === "1",
    online,
    place,
    radiusKm: Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : DEFAULT_RADIUS_KM,
    sort: (SORT_VALUES.has(sortRaw) ? sortRaw : "relevance") as EventSort,
  };
}

/** Structural type so this module stays independent of next/navigation. */
interface ReadonlyURLSearchParamsLike {
  get(name: string): string | null;
}
