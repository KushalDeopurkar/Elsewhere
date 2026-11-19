"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MagnifyingGlass,
  X,
  SlidersHorizontal,
  ClockCounterClockwise,
} from "@phosphor-icons/react/ssr";
import EventCard from "./EventCard";
import { VIBES, vibeFit, type VibeId } from "@/lib/vibe";
import AlertButton from "./AlertButton";
import { CardSkeleton, EmptyState } from "./Section";
import { useCityEvents } from "@/hooks/useCityEvents";
import { useCity, useRecentSearches, rememberSearch, clearRecentSearches } from "@/lib/cityPref";
import { CATEGORIES, Event, EventCategory } from "@/lib/types";
import { detectCity } from "@/lib/cities";
import { matchesIntentWhen, parseIntent, scoreEvent } from "@/lib/intent";
import {
  DateFilter,
  FormatFilter,
  PriceFilter,
  SortKey,
  inDateWindow,
  inFormat,
  inPrice,
  withinKm,
  sortEvents,
  upcoming,
} from "@/lib/eventFilters";
import { getCategoryColor } from "@/lib/categoryColors";

const DATES: { value: DateFilter; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "This weekend" },
  { value: "week", label: "Next 7 days" },
];
const PRICES: { value: PriceFilter; label: string }[] = [
  { value: "any", label: "Any price" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];
const FORMATS: { value: FormatFilter; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
];
const DISTANCES: { value: string; label: string; km: number | null }[] = [
  { value: "any", label: "Whole city", km: null },
  { value: "5", label: "5 km", km: 5 },
  { value: "10", label: "10 km", km: 10 },
  { value: "25", label: "25 km", km: 25 },
];
const PAGE = 24;
const SORTS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "soonest", label: "Soonest" },
  { value: "price", label: "Lowest price" },
  { value: "distance", label: "Nearest" },
];
const SUGGESTIONS = [
  "I want to attend AI events this weekend",
  "Find free workshops near me",
  "I want to meet startup founders",
  "Beginner-friendly coding events",
  "Live music this weekend",
];

function pick<T extends string>(v: string | null, allowed: readonly T[], fallback: T): T {
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/**
 * Explore: every upcoming event around the chosen city, with search by
 * meaning, filters and sorting. State lives in the URL, so any view can be
 * shared or bookmarked. Category pages reuse this with the category locked.
 */
export default function ExploreView({ lockedCategory }: { lockedCategory?: EventCategory }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const homeCity = useCity();
  const recent = useRecentSearches();

  const q = params.get("q") ?? "";
  // A place named in the search ("paris on saturday") wins over the header
  // city for this search only; the header choice stays as it was.
  const named = useMemo(() => (q ? detectCity(q)?.city ?? null : null), [q]);
  const city = named ?? homeCity;
  const cat = lockedCategory ?? (CATEGORIES.find((c) => c.value === params.get("cat"))?.value ?? null);
  const when = pick(params.get("when"), DATES.map((d) => d.value), "any");
  const price = pick(params.get("price"), PRICES.map((p) => p.value), "any");
  const sort = pick(params.get("sort"), SORTS.map((s) => s.value), q ? "relevance" : "soonest");
  const mood = pick<VibeId | "any">(params.get("mood"), ["any", ...VIBES.map((v) => v.id)], "any");
  const format = pick(params.get("format"), FORMATS.map((f) => f.value), "any");
  const within = pick(params.get("within"), DISTANCES.map((d) => d.value), "any");
  const withinKmValue = DISTANCES.find((d) => d.value === within)?.km ?? null;

  const [draft, setDraft] = useState(q);
  const [drawer, setDrawer] = useState(false);
  const drawerPanel = useRef<HTMLDivElement>(null);
  const filtersBtn = useRef<HTMLButtonElement>(null);

  // The filters drawer is a modal: focus moves in, Escape closes it, focus
  // returns to the button that opened it, and Tab stays inside.
  useEffect(() => {
    if (!drawer) return;
    const panel = drawerPanel.current;
    const opener = filtersBtn.current;
    panel?.querySelector<HTMLElement>("button, [href], input, select")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(false);
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>("button, [href], input, select")].filter((el) => !el.hasAttribute("disabled"));
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [drawer]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the box in step with back/forward navigation (React's documented
  // "adjust state when a prop changes" pattern).
  const [seenQ, setSeenQ] = useState(q);
  if (seenQ !== q) {
    setSeenQ(q);
    setDraft(q);
  }

  useEffect(() => {
    if (params.get("focus")) inputRef.current?.focus();
  }, [params]);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    next.delete("focus");
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "" || v === "any") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const submit = (text: string) => {
    const t = text.trim();
    if (t) rememberSearch(t);
    setParams({ q: t || null, sort: null });
  };

  // Keyword/category pool from the existing search API.
  const pool = useCityEvents(city, { category: cat, limit: 100 });
  // The keyword pool is fetched 100 at a time; a full page means there are more.

  // Meaning-based matches for a typed query.
  const [semantic, setSemantic] = useState<{ key: string; events: Event[]; ok: boolean } | null>(null);
  const semKey = `${q}|${city.name}`;
  useEffect(() => {
    if (!q) return;
    let live = true;
    fetch(`/api/semantic?q=${encodeURIComponent(q)}&city=${encodeURIComponent(city.name)}&limit=40`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => live && setSemantic({ key: semKey, events: j.data ?? [], ok: true }))
      .catch(() => live && setSemantic({ key: semKey, events: [], ok: false }));
    return () => {
      live = false;
    };
  }, [q, city.name, semKey]);
  const semReady = !q || semantic?.key === semKey;
  const meaning = useMemo(
    () => (q && semantic?.key === semKey ? semantic.events : []),
    [q, semantic, semKey],
  );

  const intent = useMemo(() => (q ? parseIntent(q) : null), [q]);

  const results = useMemo(() => {
    const base = upcoming(pool.events);
    const meaningIds = new Set(meaning.map((e) => e.id));
    let list: { event: Event; byMeaning: boolean; score: number; reasons: string[] }[];
    if (q && intent) {
      // Place is applied as a radius around the city; scraped city names vary.
      const scoring = { ...intent, city: null };
      const keyword = base
        .map((e) => ({ e, s: scoreEvent(e, scoring) }))
        .filter((x) => x.s && !meaningIds.has(x.e.id))
        .map((x) => ({ event: x.e, byMeaning: false, score: x.s!.score, reasons: x.s!.reasons }));
      const semantic = upcoming(meaning)
        .filter((e) => !cat || e.category === cat)
        .filter((e) => matchesIntentWhen(e, intent) && (!intent.freeOnly || e.is_free))
        .map((e, i) => ({
          event: e,
          byMeaning: true,
          score: 100 - i,
          // Say what matched in words, and that the rest was meaning.
          reasons: [...(scoreEvent(e, scoring)?.reasons ?? []).filter((r) => !r.startsWith("Related")), "Close in meaning to your words"],
        }));
      list = [...semantic, ...keyword.sort((a, b) => b.score - a.score)];
    } else {
      list = base.map((e) => ({ event: e, byMeaning: false, score: 0, reasons: [] }));
    }
    list = list.filter(
      (x) =>
        inDateWindow(x.event, when) &&
        inPrice(x.event, price) &&
        inFormat(x.event, format) &&
        withinKm(x.event, withinKmValue, city.lat, city.lng) &&
        (mood === "any" || vibeFit(x.event, [mood]) > 0),
    );
    if (sort !== "relevance") {
      const order = sortEvents(list.map((x) => x.event), sort);
      const byId = new Map(list.map((x) => [x.event.id, x]));
      list = order.map((e) => byId.get(e.id)!);
    }
    return list;
  }, [pool.events, meaning, q, intent, cat, when, price, format, withinKmValue, city.lat, city.lng, mood, sort]);

  // Show a page at a time; the count resets whenever the question changes.
  const viewKey = `${q}|${cat}|${when}|${price}|${format}|${within}|${mood}|${sort}|${city.name}`;
  const [shown, setShown] = useState({ key: viewKey, n: PAGE });
  const limit = shown.key === viewKey ? shown.n : PAGE;
  const visible = results.slice(0, limit);

  const loading = pool.loading || !semReady;
  // Every filter in force, as a chip that removes it.
  const active: { key: string; label: string; clear: Record<string, null> }[] = [
    ...(!lockedCategory && cat ? [{ key: "cat", label: CATEGORIES.find((c) => c.value === cat)?.label ?? cat, clear: { cat: null } }] : []),
    ...(mood !== "any" ? [{ key: "mood", label: VIBES.find((v) => v.id === mood)?.label ?? mood, clear: { mood: null } }] : []),
    ...(when !== "any" ? [{ key: "when", label: DATES.find((d) => d.value === when)!.label, clear: { when: null } }] : []),
    ...(price !== "any" ? [{ key: "price", label: PRICES.find((p) => p.value === price)!.label, clear: { price: null } }] : []),
    ...(format !== "any" ? [{ key: "format", label: FORMATS.find((f) => f.value === format)!.label, clear: { format: null } }] : []),
    ...(within !== "any" ? [{ key: "within", label: `Within ${DISTANCES.find((d) => d.value === within)!.label}`, clear: { within: null } }] : []),
  ];
  const activeCount = active.length;
  const clearAll = { cat: null, mood: null, when: null, price: null, format: null, within: null };

  const filters = (
    <div className="filters">
      {!lockedCategory && (
        <fieldset className="fgroup">
          <legend>Category</legend>
          <div className="fchips">
            <button type="button" className="fchip" aria-pressed={!cat} onClick={() => setParams({ cat: null })}>
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                className="fchip"
                aria-pressed={cat === c.value}
                style={{ "--chip-hue": getCategoryColor(c.value).color } as React.CSSProperties}
                onClick={() => setParams({ cat: cat === c.value ? null : c.value })}
              >
                <span className="chip-dot" aria-hidden="true" />
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="fgroup">
        <legend>Mood</legend>
        <div className="fchips">
          <button type="button" className="fchip" aria-pressed={mood === "any"} onClick={() => setParams({ mood: null })}>
            Any
          </button>
          {VIBES.map((v) => (
            <button
              key={v.id}
              type="button"
              className="fchip"
              aria-pressed={mood === v.id}
              title={v.line}
              onClick={() => setParams({ mood: mood === v.id ? null : v.id })}
            >
              {v.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="fgroup">
        <legend>Date</legend>
        <div className="fchips">
          {DATES.map((d) => (
            <button key={d.value} type="button" className="fchip" aria-pressed={when === d.value} onClick={() => setParams({ when: d.value })}>
              {d.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="fgroup">
        <legend>Price</legend>
        <div className="fchips">
          {PRICES.map((p) => (
            <button key={p.value} type="button" className="fchip" aria-pressed={price === p.value} onClick={() => setParams({ price: p.value })}>
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="fgroup">
        <legend>Format</legend>
        <div className="fchips">
          {FORMATS.map((f) => (
            <button key={f.value} type="button" className="fchip" aria-pressed={format === f.value} onClick={() => setParams({ format: f.value })}>
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="fgroup">
        <legend>Distance</legend>
        <div className="fchips">
          {DISTANCES.map((d) => (
            <button key={d.value} type="button" className="fchip" aria-pressed={within === d.value} onClick={() => setParams({ within: d.value })}>
              {d.label}
            </button>
          ))}
        </div>
        <p className="fnote">
          From the centre of {city.name}.{" "}
          {named && named.name !== homeCity.name ? "The city was set by your search." : "Change the city at the top of the page."}
        </p>
      </fieldset>
      {activeCount > 0 && (
        <button
          type="button"
          className="btn btn-ghost freset"
          onClick={() => setParams(clearAll)}
        >
          <X size={14} weight="bold" /> Reset filters
        </button>
      )}
    </div>
  );

  return (
    <div className="explore shell">
      <form
        className="xsearch"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <label className="xsearch-label" htmlFor="xsearch-input">
          Where to?
        </label>
        <input
          ref={inputRef}
          id="xsearch-input"
          className="xsearch-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Free workshops"
          enterKeyHint="search"
        />
        {draft && (
          <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => { setDraft(""); submit(""); }}>
            <X size={15} weight="bold" />
          </button>
        )}
        <button type="submit" className="btn btn-primary xsearch-go">Search</button>
      </form>

      {!q && (
        <div className="xsuggest">
          {recent.length > 0 && (
            <>
              <span className="xsuggest-label"><ClockCounterClockwise size={14} weight="bold" /> Recent</span>
              {recent.map((r) => (
                <button key={r} type="button" className="chip-prompt" onClick={() => submit(r)}>{r}</button>
              ))}
              <button type="button" className="xsuggest-clear" onClick={clearRecentSearches}>Clear</button>
            </>
          )}
          {recent.length === 0 &&
            SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip-prompt" onClick={() => submit(s)}>{s}</button>
            ))}
        </div>
      )}

      {q && intent && (
        <div className="xread">
          <span className="xread-label">Reading “{q}” as</span>
          {intent.signals.length === 0 && <span className="xread-chip">meaning only</span>}
          {intent.signals.map((s) => (
            <span key={`${s.kind}-${s.value}`} className="xread-chip"><b>{s.kind}</b> {s.label}</span>
          ))}
          {intent.unsupported.length > 0 && (
            <span className="xread-note">
              Listings don&apos;t say {intent.unsupported.join(" or ")}, so that part is matched by meaning only.
            </span>
          )}
        </div>
      )}

      <div className="xlayout">
        <aside className="xside" aria-label="Filters">{filters}</aside>

        <section className="xmain" aria-live="polite" aria-labelledby="xresults-h">
          <h2 id="xresults-h" className="sr-only">Results</h2>
          <div className="xbar">
            <p className="xcount">
              {loading ? "Searching…" : `${results.length}${pool.events.length >= 100 && results.length >= 100 ? "+" : ""} event${results.length === 1 ? "" : "s"}`}
              <span> near {city.name}</span>
            </p>
            <div className="xbar-end">
              <button ref={filtersBtn} type="button" className="btn btn-ghost xfilters-btn" aria-haspopup="dialog" onClick={() => setDrawer(true)}>
                <SlidersHorizontal size={16} weight="bold" /> Filters{activeCount ? ` (${activeCount})` : ""}
              </button>
              <label className="xsort">
                <span className="sr-only">Sort by</span>
                <select value={sort} onChange={(e) => setParams({ sort: e.target.value })}>
                  {SORTS.filter((s) => q || s.value !== "relevance").map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {active.length > 0 && (
            <div className="xactive" aria-label="Filters in use">
              {active.map((a) => (
                <button key={a.key} type="button" className="xactive-chip" onClick={() => setParams(a.clear)} aria-label={`Remove filter: ${a.label}`}>
                  {a.label}
                  <X size={12} weight="bold" aria-hidden="true" />
                </button>
              ))}
              {active.length > 1 && (
                <button type="button" className="xactive-clear" onClick={() => setParams(clearAll)}>
                  Clear all
                </button>
              )}
            </div>
          )}

          {q && !loading && (
            <div className="xalert">
              <AlertButton query={q} city={city.name} hint="Get new matches for this search by Telegram or email." />
            </div>
          )}

          {pool.isSample && !loading && (
            <p className="notice">Live data is unreachable right now, so these are sample events.</p>
          )}

          {loading ? (
            <div className="xgrid">
              {Array.from({ length: 6 }, (_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : pool.error ? (
            <EmptyState title="Events didn't load" body={pool.error}>
              <button type="button" className="btn btn-primary" onClick={pool.retry}>Try again</button>
            </EmptyState>
          ) : results.length === 0 ? (
            <EmptyState
              icon={<MagnifyingGlass size={28} weight="bold" />}
              title="No events match"
              body={q ? "Try fewer words, a wider date range, or another city." : "Widen the date range or clear a filter."}
            >
              <button type="button" className="btn btn-ghost" onClick={() => { setDraft(""); setParams({ q: null, ...clearAll }); }}>
                Reset search and filters
              </button>
            </EmptyState>
          ) : (
            <>
              <div className="xgrid">
                {visible.map((r, i) => (
                  <EventCard key={r.event.id} event={r.event} priority={i < 3} reasons={q ? r.reasons : undefined} />
                ))}
              </div>
              {results.length > visible.length && (
                <div className="xmore">
                  <p className="xmore-count">
                    Showing {visible.length} of {results.length}
                  </p>
                  <button type="button" className="btn btn-ghost" onClick={() => setShown({ key: viewKey, n: limit + PAGE })}>
                    Show {Math.min(PAGE, results.length - visible.length)} more
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {drawer && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" className="drawer-scrim" aria-label="Close filters" onClick={() => setDrawer(false)} />
          <div className="drawer-panel" ref={drawerPanel}>
            <div className="drawer-head">
              <p className="drawer-title">Filters</p>
              <button type="button" className="icon-btn" aria-label="Close filters" onClick={() => setDrawer(false)}>
                <X size={18} weight="bold" />
              </button>
            </div>
            {filters}
            <button type="button" className="btn btn-primary drawer-done" onClick={() => setDrawer(false)}>
              Show {results.length} event{results.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
