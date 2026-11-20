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
import { cityCountry, cityZone, detectCity } from "@/lib/cities";
import { addDays, readDays, zonedTime } from "@/lib/when";
import { correctQuery, isKnownWord } from "@/lib/spell";
import { wordsOf } from "@/lib/fuzzy";
import { dropSignal, parseIntent, passesFilters, scoreEvent, widenIntent, widenable, type Widen } from "@/lib/intent";
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
import TryElsewhere from "./TryElsewhere";

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
  const recent = useRecentSearches(homeCity.name);

  // What was typed, as typed. The search itself reads a spell-checked copy
  // (q, below) unless the person asked for exactly their words (?exact=1).
  const typed = params.get("q") ?? "";
  const asTyped = params.get("exact") === "1";
  // A place named in the search ("paris on saturday", or "pars", "par") wins
  // over the header city for this search only; the header stays as it was.
  const named = useMemo(
    () => (typed ? detectCity(asTyped ? typed : correctQuery(typed).text)?.city ?? null : null),
    [typed, asTyped],
  );
  const city = named ?? homeCity;
  const cat = lockedCategory ?? (CATEGORIES.find((c) => c.value === params.get("cat"))?.value ?? null);
  const when = pick(params.get("when"), DATES.map((d) => d.value), "any");
  const price = pick(params.get("price"), PRICES.map((p) => p.value), "any");
  const sort = pick(params.get("sort"), SORTS.map((s) => s.value), typed ? "relevance" : "soonest");
  const mood = pick<VibeId | "any">(params.get("mood"), ["any", ...VIBES.map((v) => v.id)], "any");
  const format = pick(params.get("format"), FORMATS.map((f) => f.value), "any");
  const within = pick(params.get("within"), DISTANCES.map((d) => d.value), "any");
  const withinKmValue = DISTANCES.find((d) => d.value === within)?.km ?? null;

  const [draft, setDraft] = useState(typed);
  const [drawer, setDrawer] = useState(false);
  const drawerPanel = useRef<HTMLDivElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  // A removed chip takes its button with it; send focus somewhere that stays.
  const focusResults = () => requestAnimationFrame(() => resultsHeading.current?.focus());
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
  const [seenQ, setSeenQ] = useState(typed);
  if (seenQ !== typed) {
    setSeenQ(typed);
    setDraft(typed);
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
    setParams({ q: t || null, sort: null, widen: null, drop: null, exact: null });
  };

  // How this city writes dates and what "cheap" means in its money.
  const readOpts = useMemo(
    () => ({ zone: cityZone(city), dayFirst: cityCountry(city) !== "US", cheap: cityCountry(city) === "IN" ? 500 : 25 }),
    [city],
  );
  // A first read of the request decides what to fetch: the asked-for days
  // (so a date weeks away isn't cut off by "the next 100 events") and the
  // words to find (searched on the server too, beyond the loaded events).
  const [openedAt] = useState(() => Date.now());
  const early = useMemo(() => {
    const zone = readOpts.zone;
    // Days from the words win; otherwise the date filter's window. Either
    // way the server is asked for those days, so nothing past the first
    // 100 upcoming events is out of reach.
    const read = typed ? parseIntent(asTyped ? typed : correctQuery(typed).text, readOpts) : null;
    const phrase = { today: "today", tomorrow: "tomorrow", weekend: "this weekend", week: "next 7 days" } as Record<string, string>;
    const range = read?.range ?? (when !== "any" && phrase[when] ? readDays(phrase[when], openedAt, zone) : null);
    const from = range ? new Date(Math.max(openedAt - 6 * 3_600_000, zonedTime(addDays(range.from, -1), 0, zone))).toISOString() : undefined;
    const to = range ? new Date(zonedTime(addDays(range.to, 1), 6, zone)).toISOString() : undefined;
    return { from, to, words: read?.terms.join(" ") ?? "" };
  }, [typed, asTyped, readOpts, openedAt, when]);

  // Keyword/category pool from the existing search API.
  const pool = useCityEvents(city, { category: cat, limit: 100, from: early?.from, to: early?.to });
  // The same window searched for the words themselves (server full text).
  const wordPool = useCityEvents(city, {
    category: cat,
    limit: 100,
    q: early?.words || undefined,
    from: early?.from,
    to: early?.to,
    skip: !early?.words,
  });
  const allEvents = useMemo(() => {
    const seen = new Set<string>();
    return [...pool.events, ...wordPool.events].filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  }, [pool.events, wordPool.events]);

  // Spelling: fix typos and unfinished place names before the search reads
  // the words. Words from the events on show count as real words, and their
  // misspellings are fixed too ("comdey" finds the comedy nights).
  const seenWords = useMemo(() => {
    const out = new Set<string>();
    for (const e of allEvents) for (const w of wordsOf(`${e.title} ${e.location_name ?? ""}`)) out.add(w);
    return out;
  }, [allEvents]);
  const spelled = useMemo(
    () => (typed && !asTyped ? correctQuery(typed, seenWords) : { text: typed, fixes: [] }),
    [typed, asTyped, seenWords],
  );
  const q = spelled.text;
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

  // "widen" lets go of parts of the request (any date, paid too, any
  // category) when the exact ask comes back thin. It lives in the URL so a
  // widened search can be shared and the back button undoes it.
  const widenParam = params.get("widen") ?? "";
  const widen = useMemo(
    () => widenParam.split(",").filter((w): w is Widen => w === "when" || w === "free" || w === "topic" || w === "words"),
    [widenParam],
  );
  // "drop" removes single signals the reader got wrong ("interest:music").
  const dropParam = params.get("drop") ?? "";
  const asked = useMemo(() => {
    if (!q) return null;
    let read = parseIntent(q, readOpts);
    for (const key of dropParam.split(",").filter(Boolean)) {
      const sig = read.signals.find((x) => `${x.kind}:${x.value}` === key);
      if (sig) read = dropSignal(read, sig);
    }
    return read;
  }, [q, dropParam, readOpts]);
  const intent = useMemo(() => (asked ? widenIntent(asked, widen) : null), [asked, widen]);
  const exact = widen.length === 0 && !dropParam;

  // Exact matches first (every word found, every filter met), then events
  // that only share the topic or are close in meaning, under their own
  // heading. Without words to find, every event that meets the filters is
  // a match.
  const results = useMemo(() => {
    const base = upcoming(allEvents);
    let list: { event: Event; byMeaning: boolean; score: number; reasons: string[]; related: boolean }[];
    if (q && intent) {
      // Place is applied as a radius around the city; scraped city names vary.
      const scoring = { ...intent, city: null };
      const scored = base
        .map((e) => scoreEvent(e, scoring))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      const byScore = (a: { score: number; event: Event }, b: { score: number; event: Event }) =>
        b.score - a.score || Date.parse(a.event.start_time) - Date.parse(b.event.start_time);
      const exactHits = scored.filter((x) => x.exact).sort(byScore);
      const shown = new Set(exactHits.map((x) => x.event.id));
      const partial = scored.filter((x) => !x.exact).sort(byScore);
      partial.forEach((x) => shown.add(x.event.id));
      const wordsAsked = intent.terms.length + intent.phrases.length > 0;
      // Words that appear nowhere (not in any listing, not in the search's
      // vocabulary) are noise: no "related" results for them either.
      const nonsense =
        wordsAsked &&
        intent.signals.every((x) => x.kind === "words") &&
        intent.terms.every((t) => !isKnownWord(t) && !seenWords.has(t));
      const semantic = wordsAsked && !nonsense
        ? upcoming(meaning)
            .filter((e) => !shown.has(e.id) && (!cat || e.category === cat) && passesFilters(e, scoring))
            .map((e) => ({
              event: e,
              byMeaning: true,
              score: 0,
              related: true,
              reasons: ["Close in meaning to your words", ...(scoreEvent(e, scoring)?.reasons ?? []).slice(0, 2)],
            }))
        : [];
      list = [
        ...exactHits.map((x) => ({ event: x.event, byMeaning: false, score: x.score, reasons: x.reasons, related: false })),
        ...partial.map((x) => ({ event: x.event, byMeaning: false, score: x.score, reasons: x.reasons, related: true })),
        ...semantic,
      ];
    } else {
      list = base.map((e) => ({ event: e, byMeaning: false, score: 0, reasons: [], related: false }));
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
      // Re-order within each part; exact matches stay above related ones.
      const byId = new Map(list.map((x) => [x.event.id, x]));
      const tier = (rel: boolean) => sortEvents(list.filter((x) => x.related === rel).map((x) => x.event), sort).map((e) => byId.get(e.id)!);
      list = [...tier(false), ...tier(true)];
    }
    return list;
  }, [allEvents, meaning, q, intent, cat, when, price, format, withinKmValue, city.lat, city.lng, mood, sort, seenWords]);
  const matchCount = results.filter((r) => !r.related).length;
  // Remember a search once it has found something (junk isn't kept), under
  // the city it's for, so Mumbai's recent searches aren't Paris's.
  const rememberedFor = useRef("");
  useEffect(() => {
    if (!typed || pool.loading || matchCount === 0) return;
    const k = `${typed}|${homeCity.name}`;
    if (rememberedFor.current === k) return;
    rememberedFor.current = k;
    rememberSearch(typed, homeCity.name);
  }, [typed, homeCity.name, pool.loading, matchCount]);

  // Named interests with nothing to show: say so, rather than let closest
  // matches from other categories pass for an answer.
  const missing = useMemo(() => {
    if (!intent || pool.loading || !semReady) return [];
    const named = intent.signals.filter((x) => x.kind === "interest" && x.strict).map((x) => x.value as EventCategory);
    return named
      .filter((c) => !results.some((r) => !r.related && r.event.category === c))
      .map((c) => CATEGORIES.find((x) => x.value === c)?.label ?? c);
  }, [intent, pool.loading, semReady, results]);

  // When the exact request is thin, offer to let go of one part at a time,
  // with how many more events each would bring in. Counts use the same
  // filters as the list, so a suggestion never promises what it can't show.
  const widenOptions = useMemo(() => {
    if (!asked || !intent || pool.loading || matchCount >= 4) return [];
    const base = upcoming(allEvents);
    const shownIds = new Set(results.filter((r) => !r.related).map((r) => r.event.id));
    const label: Record<Widen, string> = { when: "Any date or time", free: "Any price", topic: "Any kind of event", words: "Some of the words" };
    return widenable(intent)
      .map((w) => {
        const wider = { ...widenIntent(intent, [w]), city: null };
        const extra = base.filter(
          (e) =>
            !shownIds.has(e.id) &&
            scoreEvent(e, wider)?.exact &&
            inDateWindow(e, when) &&
            inPrice(e, price) &&
            inFormat(e, format) &&
            withinKm(e, withinKmValue, city.lat, city.lng),
        ).length;
        return { w, label: label[w], extra };
      })
      .filter((o) => o.extra > 0);
  }, [asked, intent, pool.loading, allEvents, results, matchCount, when, price, format, withinKmValue, city.lat, city.lng]);

  // Show a page at a time; the count resets whenever the question changes.
  const viewKey = `${q}|${widenParam}|${dropParam}|${cat}|${when}|${price}|${format}|${within}|${mood}|${sort}|${city.name}`;
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
          {!cat && intent && intent.strict.length > 0 && (
            <p className="fnote is-words">
              From your words: {intent.strict.map((c) => CATEGORIES.find((x) => x.value === c)?.label ?? c).join(", ")}
            </p>
          )}
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
              {when === "any" && intent && (intent.range || intent.hours) && (
                <p className="fnote is-words">
                  From your words: {[intent.range?.label, intent.hours?.label].filter(Boolean).join(", ")}
                </p>
              )}
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
              {price === "any" && (intent?.freeOnly || intent?.cap) && <p className="fnote is-words">From your words: {intent?.freeOnly ? "Free" : intent?.cap?.label}</p>}
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
              {format === "any" && intent?.format && <p className="fnote is-words">From your words: {intent?.format === "online" ? "Online" : "In person"}</p>}
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
          Ask Elsewhere, or search
        </label>
        <input
          ref={inputRef}
          id="xsearch-input"
          className="xsearch-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Free AI workshops"
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

      {spelled.fixes.length > 0 && (
        <p className="xspell" role="status">
          Showing results for <strong>{q}</strong>
          <span className="xspell-sep" aria-hidden="true">·</span>
          <button type="button" className="xspell-undo" onClick={() => setParams({ exact: "1", widen: null, drop: null })}>
            Search instead for “{typed}”
          </button>
        </p>
      )}
      {asTyped && typed && correctQuery(typed, seenWords).fixes.length > 0 && (
        <p className="xspell" role="status">
          Searching exactly “{typed}”.
          <button type="button" className="xspell-undo" onClick={() => setParams({ exact: null })}>
            Did you mean <strong>{correctQuery(typed, seenWords).text}</strong>?
          </button>
        </p>
      )}

      {q && intent && (
        <div className="xread">
          <span className="xread-label">Reading “{q}” as</span>
          {intent.signals.length === 0 && <span className="xread-chip">meaning only</span>}
          {/* Topics a word only hints at rank results quietly; the word itself is the chip. */}
          {intent.signals.filter((s) => s.kind !== "interest" || s.strict).map((s) => (
            <button
              key={`${s.kind}-${s.value}`}
              type="button"
              className="xread-chip"
              aria-label={`Stop reading ${s.label} as ${s.kind}`}
              onClick={() => {
                setParams({ drop: [...dropParam.split(",").filter(Boolean), `${s.kind}:${s.value}`].join(",") });
                focusResults();
              }}
            >
              <b>{s.kind}</b> {s.label}
              <X size={11} weight="bold" aria-hidden="true" />
            </button>
          ))}
          {!exact && (
            <button
              type="button"
              className="xread-undo"
              onClick={() => {
                setParams({ widen: null, drop: null });
                focusResults();
              }}
            >
              Back to exactly what you asked
            </button>
          )}
          {missing.length > 0 && (
            <span className="xread-note is-miss">
              Nothing in {missing.join(" or ")} near {city.name} right now, so these are the closest matches.
            </span>
          )}
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
          <h2 id="xresults-h" className="sr-only" tabIndex={-1} ref={resultsHeading}>
            Results
          </h2>
          <div className="xbar">
            <p className="xcount">
              {loading
                ? "Searching…"
                : q
                  ? `${matchCount} ${matchCount === 1 ? "match" : "matches"}`
                  : `${results.length}${pool.more ? "+" : ""} event${results.length === 1 ? "" : "s"}`}
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
                <button
                  key={a.key}
                  type="button"
                  className="xactive-chip"
                  onClick={() => {
                    setParams(a.clear);
                    focusResults();
                  }}
                  aria-label={`Remove filter: ${a.label}`}
                >
                  {a.label}
                  <X size={12} weight="bold" aria-hidden="true" />
                </button>
              ))}
              {active.length > 1 && (
                <button
                  type="button"
                  className="xactive-clear"
                  onClick={() => {
                    setParams(clearAll);
                    focusResults();
                  }}
                >
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

          {!loading && widenOptions.length > 0 && (
            <div className="xwiden" role="group" aria-label="Widen the search">
              <p className="xwiden-lead">
                {matchCount === 0
                  ? `Nothing matches${exact ? " exactly" : ""}.`
                  : `Only ${matchCount} ${matchCount === 1 ? "matches" : "match"}${exact ? " exactly" : ""}.`}{" "}
                Let one part go:
              </p>
              <ul>
                {widenOptions.map((o) => (
                  <li key={o.w}>
                    <button
                      type="button"
                      className="xwiden-btn"
                      onClick={() => setParams({ widen: [...widen, o.w].join(",") })}
                    >
                      {o.label}
                      <span className="xwiden-n">+{o.extra}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
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
              {!named && <TryElsewhere city={city} />}
            </EmptyState>
          ) : (
            <>
              {q && matchCount === 0 && (
                <p className="xnone">
                  Nothing matches “{intent?.signals.find((x) => x.kind === "words")?.label ?? q}” with everything you asked for. These are related.
                </p>
              )}
              {visible.some((r) => !r.related) && (
                <div className="xgrid">
                  {visible.filter((r) => !r.related).map((r, i) => (
                    <EventCard key={r.event.id} event={r.event} priority={i < 3} reasons={q ? r.reasons : undefined} />
                  ))}
                </div>
              )}
              {visible.some((r) => r.related) && (
                <>
                  <h3 className="xtier">
                    Related to your search
                    <span> Same topic or close in meaning, but not every word you typed</span>
                  </h3>
                  <div className="xgrid">
                    {visible.filter((r) => r.related).map((r) => (
                      <EventCard key={r.event.id} event={r.event} reasons={r.reasons} />
                    ))}
                  </div>
                </>
              )}
              {(results.length > visible.length || pool.more) && (
                <div className="xmore">
                  <p className="xmore-count">
                    Showing {visible.length} of {results.length}
                    {pool.more ? "+" : ""}
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={pool.paging}
                    onClick={async () => {
                      // Past what is loaded, fetch the next page from the server first.
                      if (results.length - visible.length < PAGE && pool.more) await pool.loadMore();
                      setShown({ key: viewKey, n: limit + PAGE });
                    }}
                  >
                    {pool.paging
                      ? "Loading…"
                      : results.length > visible.length
                        ? `Show ${Math.min(PAGE, results.length - visible.length)} more`
                        : "Show more"}
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
