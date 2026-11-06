"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MagnifyingGlass,
  X,
  SquaresFour,
  List,
  SlidersHorizontal,
  Sparkle,
  ClockCounterClockwise,
} from "@phosphor-icons/react/ssr";
import EventCard from "./EventCard";
import AlertButton from "./AlertButton";
import { CardSkeleton, EmptyState } from "./Section";
import { useCityEvents } from "@/hooks/useCityEvents";
import { useCity, useRecentSearches, rememberSearch, clearRecentSearches } from "@/lib/cityPref";
import { CATEGORIES, Event, EventCategory } from "@/lib/types";
import { parseIntent, scoreEvent } from "@/lib/intent";
import {
  DateFilter,
  PriceFilter,
  SortKey,
  inDateWindow,
  inPrice,
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

type View = "grid" | "list";

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
  const city = useCity();
  const recent = useRecentSearches();

  const q = params.get("q") ?? "";
  const cat = lockedCategory ?? (CATEGORIES.find((c) => c.value === params.get("cat"))?.value ?? null);
  const when = pick(params.get("when"), DATES.map((d) => d.value), "any");
  const price = pick(params.get("price"), PRICES.map((p) => p.value), "any");
  const sort = pick(params.get("sort"), SORTS.map((s) => s.value), q ? "relevance" : "soonest");
  const view = pick<View>(params.get("view"), ["grid", "list"], "grid");

  const [draft, setDraft] = useState(q);
  const [drawer, setDrawer] = useState(false);
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
    let list: { event: Event; byMeaning: boolean; score: number }[];
    if (q && intent) {
      // Place is applied as a radius around the city; scraped city names vary.
      const scoring = { ...intent, city: null };
      const keyword = base
        .map((e) => ({ e, s: scoreEvent(e, scoring) }))
        .filter((x) => x.s && !meaningIds.has(x.e.id))
        .map((x) => ({ event: x.e, byMeaning: false, score: x.s!.score }));
      const semantic = upcoming(meaning)
        .filter((e) => !cat || e.category === cat)
        .filter((e) => (intent.when === "any" || inDateWindow(e, intent.when)) && (!intent.freeOnly || e.is_free))
        .map((e, i) => ({ event: e, byMeaning: true, score: 100 - i }));
      list = [...semantic, ...keyword.sort((a, b) => b.score - a.score)];
    } else {
      list = base.map((e) => ({ event: e, byMeaning: false, score: 0 }));
    }
    list = list.filter((x) => inDateWindow(x.event, when) && inPrice(x.event, price));
    if (sort !== "relevance") {
      const order = sortEvents(list.map((x) => x.event), sort);
      const byId = new Map(list.map((x) => [x.event.id, x]));
      list = order.map((e) => byId.get(e.id)!);
    }
    return list;
  }, [pool.events, meaning, q, intent, cat, when, price, sort]);

  const loading = pool.loading || !semReady;
  const activeCount = [!lockedCategory && cat, when !== "any", price !== "any"].filter(Boolean).length;

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
        <legend>Location</legend>
        <p className="fnote">Within 40 km of {city.name}. Change the city at the top of the page.</p>
      </fieldset>
      {activeCount > 0 && (
        <button
          type="button"
          className="btn btn-ghost freset"
          onClick={() => setParams({ cat: lockedCategory ? null : null, when: null, price: null })}
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
        <MagnifyingGlass size={19} weight="bold" className="xsearch-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          className="xsearch-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Describe what you want, e.g. ‘free workshops this weekend’"
          aria-label="Search events"
          enterKeyHint="search"
        />
        {draft && (
          <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => { setDraft(""); submit(""); }}>
            <X size={15} weight="bold" />
          </button>
        )}
        <button type="submit" className="btn btn-primary">Search</button>
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
          <span className="xread-label"><Sparkle size={13} weight="fill" /> Reading “{q}” as</span>
          {intent.signals.length === 0 && <span className="xread-chip">meaning only</span>}
          {intent.signals.map((s) => (
            <span key={`${s.kind}-${s.value}`} className="xread-chip"><b>{s.kind}</b> {s.label}</span>
          ))}
        </div>
      )}

      <div className="xlayout">
        <aside className="xside" aria-label="Filters">{filters}</aside>

        <section className="xmain" aria-live="polite">
          <div className="xbar">
            <p className="xcount">
              {loading ? "Searching…" : `${results.length} event${results.length === 1 ? "" : "s"}`}
              <span> near {city.name}</span>
            </p>
            <div className="xbar-end">
              <button type="button" className="btn btn-ghost xfilters-btn" onClick={() => setDrawer(true)}>
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
              <div className="xview" role="group" aria-label="Layout">
                <button type="button" className="icon-btn" aria-pressed={view === "grid"} aria-label="Grid view" onClick={() => setParams({ view: null })}>
                  <SquaresFour size={17} weight={view === "grid" ? "fill" : "bold"} />
                </button>
                <button type="button" className="icon-btn" aria-pressed={view === "list"} aria-label="List view" onClick={() => setParams({ view: "list" })}>
                  <List size={17} weight="bold" />
                </button>
              </div>
            </div>
          </div>

          {q && !loading && (
            <div className="xalert">
              <AlertButton query={q} city={city.name} hint="Get new matches for this search by Telegram or email." />
            </div>
          )}

          {pool.isSample && !loading && (
            <p className="notice">Live data is unreachable right now, so these are sample events.</p>
          )}

          {loading ? (
            <div className={view === "list" ? "xlist" : "xgrid"}>
              {Array.from({ length: 6 }, (_, i) => (
                <CardSkeleton key={i} variant={view === "list" ? "list" : "standard"} />
              ))}
            </div>
          ) : pool.error ? (
            <EmptyState title="Events didn't load" body={pool.error}>
              <button type="button" className="btn btn-primary" onClick={pool.retry}>Try again</button>
            </EmptyState>
          ) : results.length === 0 ? (
            <EmptyState
              icon={<MagnifyingGlass size={30} weight="duotone" />}
              title="No events match"
              body={q ? "Try fewer words, a wider date range, or another city." : "Widen the date range or clear a filter."}
            >
              <button type="button" className="btn btn-ghost" onClick={() => { setDraft(""); setParams({ q: null, cat: null, when: null, price: null }); }}>
                Reset search and filters
              </button>
            </EmptyState>
          ) : (
            <div className={view === "list" ? "xlist" : "xgrid"}>
              {results.map((r, i) => (
                <EventCard
                  key={r.event.id}
                  event={r.event}
                  variant={view === "list" ? "list" : "standard"}
                  priority={i < 3}
                  badge={r.byMeaning ? "Matched by meaning" : undefined}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {drawer && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" className="drawer-scrim" aria-label="Close filters" onClick={() => setDrawer(false)} />
          <div className="drawer-panel">
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
