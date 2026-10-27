"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DatePreset,
  EMPTY_FILTERS,
  Filters,
  activeFilterCount,
  filtersFromSearchParams,
  filtersToQueryString,
  hasActiveFilters,
  resolveDateRange,
  toSearchParams,
} from "@/lib/filters";
import { getGroup } from "@/lib/taxonomy";
import { useEventSearch, useRails, RailConfig } from "@/hooks/useEvents";
import SearchConsole from "./SearchConsole";
import ShortcutRow from "./ShortcutRow";
import FilterPanel from "./FilterPanel";
import CategoryExplorer from "./CategoryExplorer";
import EventGrid, { GridSkeleton, SkeletonCard } from "./EventGrid";
import EventCard from "./EventCard";
import DateStrip from "./DateStrip";
import ScheduleList from "./ScheduleList";
import ViewToggle from "./ViewToggle";
import CollectionRow from "./CollectionRow";
import SectionHead from "./SectionHead";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import { SlidersIcon } from "./icons";

const RESULT_LIMIT = 48;

/** The front page shows at most this many rails; the rest is a browse away. */
const MAX_RAILS = 2;

/**
 * Discovery home.
 *
 * The URL is the single source of truth for discovery state, so every view is
 * shareable and the back button steps through refinements. Two modes: an
 * editorial browse surface when nothing is filtered, and a result grid as
 * soon as anything is.
 */
export default function DiscoverView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [panelOpen, setPanelOpen] = useState(false);

  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams]
  );

  /**
   * One time anchor per mount. Date presets resolve against this, so the
   * derived API params stay referentially stable — recomputing `new Date()`
   * every render would change the query key and refetch forever.
   */
  const [nowIso] = useState(() => new Date().toISOString());
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const showResults = hasActiveFilters(filters);

  const update = useCallback(
    (patch: Partial<Filters>) => {
      const next = { ...filters, ...patch };
      const qs = filtersToQueryString(next);
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [filters, router]
  );

  const reset = useCallback(() => {
    router.replace("/", { scroll: false });
    setPanelOpen(false);
  }, [router]);

  const params = useMemo(
    () => toSearchParams(filters, { limit: RESULT_LIMIT, now }),
    [filters, now]
  );

  // Only query in results mode; discovery mode uses the rails below.
  const { events, loading, error, retry } = useEventSearch(params, showResults);

  const railConfigs = useMemo<RailConfig[]>(() => {
    // resolveDateRange speaks {from,to}; the API takes from_time/to_time.
    const window = (preset: DatePreset) => {
      const { from, to } = resolveDateRange(preset, now);
      return { from_time: from, to_time: to };
    };
    const today = window("today");
    const weekend = window("weekend");
    const month = window("month");

    // On a Sunday the weekend window collapses onto today's, which would
    // render two rails with identical contents.
    const weekendIsToday =
      weekend.from_time === today.from_time && weekend.to_time === today.to_time;

    return [
      {
        id: "today",
        title: "Happening today",
        basis: "Starting later today, soonest first",
        href: "/?date=today",
        params: { ...today, sort_by: "date", limit: 12 },
      },
      ...(weekendIsToday
        ? []
        : [
            {
              id: "weekend",
              title: "This weekend",
              basis: "Saturday and Sunday, soonest first",
              href: "/?date=weekend",
              params: { ...weekend, sort_by: "date" as const, limit: 12 },
            },
          ]),
      {
        id: "free",
        title: "Free to attend",
        basis: "Listed as free admission, next 30 days",
        href: "/?free=1&date=month",
        params: { ...month, free_only: true, sort_by: "date", limit: 12 },
      },
      {
        id: "online",
        title: "Join from anywhere",
        basis: "Online events, next 30 days",
        href: "/?format=online&date=month",
        params: { ...month, online_only: true, sort_by: "date", limit: 12 },
      },
    ];
  }, [now]);

  const {
    rails,
    loading: railsLoading,
    error: railsError,
    retry: railsRetry,
  } = useRails(showResults ? [] : railConfigs);

  // Upcoming is the baseline shelf — it only needs events to exist at all.
  const upcoming = useMemo(
    () => ({ sort_by: "date" as const, limit: 12 }),
    []
  );
  const upcomingQuery = useEventSearch(upcoming, !showResults);

  /**
   * Three, because the featured card spans two columns: featured + 2 fills
   * exactly one row at both the three- and four-column breakpoints, and
   * stacks cleanly below them. Counts in between leave visible holes in the
   * grid, which read as a layout bug rather than as whitespace.
   */
  const leadEvents = useMemo(
    () => upcomingQuery.events.slice(0, 3),
    [upcomingQuery.events]
  );

  /**
   * Rails, deduplicated against everything already shown above them.
   *
   * The shelves overlap by nature — today's events are also the soonest
   * upcoming ones, and an online event is often free too — so without this
   * the page repeats the same cards under three different headings. Each
   * rail keeps only what is new at the point it appears, and a rail left
   * with fewer than two events is dropped rather than shown nearly empty.
   */
  const visibleRails = useMemo(() => {
    const seen = new Set(leadEvents.map((e) => e.id));
    const out: typeof rails = [];

    for (const rail of rails) {
      const fresh = rail.events.filter((e) => !seen.has(e.id));
      if (fresh.length < 2) continue;
      fresh.forEach((e) => seen.add(e.id));
      out.push({ ...rail, events: fresh });
      if (out.length === MAX_RAILS) break;
    }

    return out;
  }, [rails, leadEvents]);

  // While rails load, the skeletons stand in for every configured rail, so
  // the explorer must number past all of them or it repeats an index.
  const explorerIndex =
    (railsLoading ? Math.min(railConfigs.length, MAX_RAILS) : visibleRails.length) + 2;

  const group = filters.group ? getGroup(filters.group) : undefined;
  const subLabel = group && filters.sub
    ? group.subcategories.find((s) => s.slug === filters.sub)?.label
    : undefined;

  const heading = subLabel ?? group?.label ?? (filters.q.trim() ? `“${filters.q.trim()}”` : "Everything");
  const filterCount = activeFilterCount(filters);

  return (
    <>
      <section className={`shell hero${showResults ? " hero-compact" : ""}`}>
        <h1 className="display-xl hero-headline">
          {showResults ? (
            <>Find your next thing.</>
          ) : (
            <>
              There&rsquo;s more <em>happening</em> than you think.
            </>
          )}
        </h1>
        {!showResults && (
          <p className="hero-lede">
            Everything on, indexed from public listings — filterable by date,
            category and distance.
          </p>
        )}

        <SearchConsole value={filters.q} onSubmit={(q) => update({ q })} />
      </section>

      <div className="shell">
        <DateStrip filters={filters} now={now} onChange={update} />
      </div>

      <div className="shell">
        <div className="toolbar">
          <div className="toolbar-summary">
            <p className="micro" style={{ color: "var(--ink-faint)" }}>
              {showResults ? "Results" : "Browsing"}
            </p>
            <p style={{ fontWeight: 600 }}>
              {showResults
                ? loading
                  ? "Searching…"
                  : `${events.length}${events.length === RESULT_LIMIT ? "+" : ""} event${events.length === 1 ? "" : "s"} · ${heading}`
                : "Everything coming up"}
            </p>
          </div>
          <ShortcutRow filters={filters} onChange={update} />
          <div className="toolbar-spacer" />
          <ViewToggle view={filters.view} onChange={(view) => update({ view })} />
          {showResults && (
            <button type="button" className="button button-quiet" onClick={reset}>
              Clear all
            </button>
          )}
          <button
            type="button"
            className="button"
            aria-expanded={panelOpen}
            aria-controls="filter-panel"
            onClick={() => setPanelOpen((v) => !v)}
          >
            <SlidersIcon size={15} />
            Filters
            {filterCount > 0 && <span className="button-badge">{filterCount}</span>}
          </button>
        </div>

        {panelOpen && (
          <FilterPanel
            filters={filters}
            onChange={update}
            onReset={reset}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </div>

      {showResults ? (
        <div className="shell section" style={{ marginTop: "2rem" }}>
          {loading ? (
            <GridSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={retry} />
          ) : events.length === 0 ? (
            <EmptyState filters={filters} onChange={update} onReset={reset} />
          ) : filters.view === "list" ? (
            <ScheduleList events={events} />
          ) : (
            <EventGrid events={events} featureFirst />
          )}
        </div>
      ) : (
        <>
          <section className="shell section" aria-labelledby="upcoming-head">
            <SectionHead
              index={1}
              title="Coming up"
              basis="Every upcoming event, soonest first"
              id="upcoming-head"
              href="/?date=month"
              linkLabel="Browse all"
            />
            {upcomingQuery.loading ? (
              <GridSkeleton count={4} />
            ) : upcomingQuery.error ? (
              <ErrorState message={upcomingQuery.error} onRetry={upcomingQuery.retry} />
            ) : upcomingQuery.events.length === 0 ? (
              <EmptyState filters={EMPTY_FILTERS} onChange={update} onReset={reset} />
            ) : filters.view === "list" ? (
              <ScheduleList events={upcomingQuery.events} />
            ) : (
              <EventGrid events={leadEvents} featureFirst />
            )}
          </section>

          {railsLoading &&
            railConfigs.slice(0, MAX_RAILS).map((cfg, i) => (
              <section className="shell section" key={cfg.id}>
                <SectionHead index={i + 2} title={cfg.title} basis={cfg.basis} />
                <div className="rail">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <SkeletonCard key={j} />
                  ))}
                </div>
              </section>
            ))}

          {!railsLoading && railsError && (
            <div className="shell section">
              <ErrorState message={railsError} onRetry={railsRetry} />
            </div>
          )}

          {/* Empty rails are dropped rather than rendered as bare shelves. */}
          {!railsLoading &&
            visibleRails.map((rail, i) => (
              <section
                className="shell section"
                key={rail.id}
                aria-labelledby={`rail-${rail.id}`}
              >
                <SectionHead
                  index={i + 2}
                  title={rail.title}
                  basis={rail.basis}
                  href={rail.href}
                  id={`rail-${rail.id}`}
                />
                <div className="rail rail-posters scrollbar-hide">
                  {rail.events.map((event) => (
                    <EventCard key={event.id} event={event} variant="poster" />
                  ))}
                </div>
              </section>
            ))}

          <section className="shell section" aria-labelledby="collections-head">
            <SectionHead
              index={explorerIndex}
              title="Collections"
              basis="Editorial angles on the index — each opens the real feed"
              id="collections-head"
            />
            <CollectionRow />
          </section>

          <section className="shell section" aria-labelledby="categories-head">
            <SectionHead
              index={explorerIndex + 1}
              title="Explore by interest"
              basis="Jump into a category, then narrow by type"
              id="categories-head"
            />
            <CategoryExplorer
              onSelect={(slug) => {
                update({ group: slug, sub: null });
                // The page becomes a short result list; without this the
                // viewport stays near the old page's bottom.
                window.scrollTo({ top: 0 });
              }}
            />
          </section>
        </>
      )}
    </>
  );
}
