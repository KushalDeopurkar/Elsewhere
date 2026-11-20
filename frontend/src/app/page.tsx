"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WeekendStories from "@/components/WeekendStories";
import HeroSearch from "@/components/HeroSearch";
import Timetable from "@/components/Timetable";
import EventCard from "@/components/EventCard";
import Rail from "@/components/Rail";
import CategoryLines from "@/components/CategoryLines";
import Collections from "@/components/Collections";
import WhenNear from "@/components/WhenNear";
import SiteFooter from "@/components/SiteFooter";
import { SectionHeader, CardSkeleton, EmptyState } from "@/components/Section";
import { useCityEvents, useCategoryStats } from "@/hooks/useCityEvents";
import { useCity } from "@/lib/cityPref";
import { cityZone } from "@/lib/cities";
import { useNow } from "@/lib/clock";
import { useSaved } from "@/lib/saved";
import { CATEGORY_PAGES } from "@/lib/categoryPages";
import { pickStories } from "@/lib/stories";
import { boardRows } from "@/lib/board";
import { inDateWindow, sortEvents, upcoming, showcase, startingSoon } from "@/lib/eventFilters";
import { timedOf } from "@/lib/formatDate";
import type { Event } from "@/lib/types";
import TryElsewhere from "@/components/TryElsewhere";

function RailOf({
  events,
  label,
  loading,
  badges,
}: {
  events: Event[];
  label: string;
  loading: boolean;
  badges?: Map<string, string>;
}) {
  if (loading) {
    return (
      <Rail label={label}>
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </Rail>
    );
  }
  return (
    <Rail label={label}>
      {events.map((e) => (
        <EventCard key={e.id} event={e} badge={badges?.get(e.id)} />
      ))}
    </Rail>
  );
}

export default function Home() {
  const router = useRouter();
  const city = useCity();
  const saved = useSaved();
  const clock = useNow(60_000);

  // Old shared plan links were /?plan=…; the planner now has its own page.
  useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get("plan");
    if (plan) router.replace(`/plan-my-day?plan=${encodeURIComponent(plan)}`);
  }, [router]);

  const pool = useCityEvents(city, { limit: 100 });
  const stats = useCategoryStats(city.name);

  const all = useMemo(() => upcoming(pool.events), [pool.events]);
  // What the board shows on its first page (today, carried into tomorrow on
  // a thin day). The sections below start from what it doesn't.
  const boardIds = useMemo(() => {
    if (!clock) return new Set<string>();
    const today = boardRows(all, "today", clock).slice(0, 7);
    const later = today.length < 3 ? boardRows(all, "tomorrow", clock).slice(0, 5 - today.length) : [];
    return new Set([...today, ...later].map((r) => r.event.id));
  }, [all, clock]);
  const offBoard = useMemo(() => all.filter((e) => !boardIds.has(e.id)), [all, boardIds]);
  const featured = useMemo(() => {
    // Prefer headliners the board isn't already showing; fall back when the
    // city is quiet enough that the board holds most of the week.
    const pool = showcase(offBoard).length >= 3 ? offBoard : all;
    const week = showcase(pool).filter((e) => inDateWindow(e, "week"));
    const picked = (week.length >= 3 ? week : showcase(pool)).slice(0, 3);
    if (picked.length) return picked;
    // A city whose sources send no pictures yet still has headliners: timed
    // events this week, drawn with their category's artwork.
    const timed = sortEvents(pool.filter((e) => timedOf(e) && inDateWindow(e, "week")), "soonest");
    return (timed.length ? timed : sortEvents(pool, "soonest")).slice(0, 3);
  }, [all, offBoard]);
  const reelPool = useMemo(() => {
    const featuredIds = new Set(featured.map((e) => e.id));
    return offBoard.filter((e) => !featuredIds.has(e.id));
  }, [offBoard, featured]);
  const soon = useMemo(() => startingSoon(all).slice(0, 12), [all]);
  const soonBadges = new Map(soon.map((s) => [s.event.id, s.badge]));

  // Each event appears in one section below the board: the most specific
  // one first (headliners, starting soon, the weekend, free), then the rest
  // of the week. A section with fewer than three left is dropped.
  const { thisWeek, free, weekend } = useMemo(() => {
    const shown = new Set([...boardIds, ...[...pickStories(reelPool).events, ...featured, ...soon.map((s) => s.event)].map((e) => e.id)]);
    const take = (list: Event[]) => {
      const out = list.filter((e) => !shown.has(e.id)).slice(0, 14);
      if (out.length < 3) return [];
      out.forEach((e) => shown.add(e.id));
      return out;
    };
    const weekend = take(sortEvents(all.filter((e) => inDateWindow(e, "weekend")), "soonest"));
    const free = take(sortEvents(all.filter((e) => e.is_free), "soonest"));
    const thisWeek = take(sortEvents(all.filter((e) => inDateWindow(e, "week")), "soonest"));
    return { thisWeek, free, weekend };
  }, [all, featured, soon, boardIds, reelPool]);
  // "Handpicked" is based only on what this person saved: their categories.
  const picks = useMemo(() => {
    if (saved.length === 0) return [];
    const savedIds = new Set(saved.map((s) => s.event.id));
    const weight = new Map<string, number>();
    saved.forEach((s) => weight.set(s.event.category, (weight.get(s.event.category) ?? 0) + 1));
    return sortEvents(
      all.filter((e) => !savedIds.has(e.id) && weight.has(e.category)),
      "soonest",
    )
      .sort((a, b) => (weight.get(b.category) ?? 0) - (weight.get(a.category) ?? 0))
      .slice(0, 12);
  }, [all, saved]);

  // Collections draw from everything except the headliners and what starts in the next three hours.
  const collectionExclude = useMemo(
    () => new Set([...featured, ...soon.map((x) => x.event)].map((e) => e.id)),
    [featured, soon],
  );
  const lines = CATEGORY_PAGES.filter((c) => c.value !== "other");
  const lineStat = (v: string) => {
    const s = stats?.data.find((x) => x.value === v);
    return s ? { count: s.count ?? null, capped: s.capped } : null;
  };
  const freeCount = all.filter((e) => e.is_free).length;
  // Sections are numbered in the order they appear; some only show when they have something.
  let section = 0;
  const no = () => String(++section).padStart(2, "0");

  return (
    <>
      <div className="shell home-top">
        <Timetable
          events={all}
          city={city.name}
          zone={cityZone(city)}
          loading={pool.loading}
          lede={
            <>
              Somewhere better to be than your usual spot: workshops, gigs, matches, talks, meetups and
              exhibitions across {city.name}, gathered from across the web. Ask for what you want, or take the next departure.
            </>
          }
          aside={
            <>
              <HeroSearch />
              {(pool.loading || all.length > 0 || (stats?.total ?? 0) > 0) && (
                <dl className="home-facts" aria-busy={pool.loading}>
                  <div>
                    <dt>Upcoming</dt>
                    {/* One number for the city everywhere: the counts endpoint's total
                        (events starting from now within 40 km), else what is loaded. */}
                    <dd>
                      {stats?.total != null
                        ? stats.total
                        : pool.loading
                          ? "–"
                          : `${all.length}${pool.more ? "+" : ""}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Free entry</dt>
                    <dd>{pool.loading ? "–" : freeCount}</dd>
                  </div>
                  <div>
                    <dt>Kinds of event</dt>
                    <dd>{pool.loading ? "–" : new Set(all.map((e) => e.category)).size}</dd>
                  </div>
                </dl>
              )}
            </>
          }
        />
      </div>

      {pool.isSample && (
        <div className="shell">
          <p className="notice">
            <strong>Sample timetable.</strong> Live listings can&apos;t be reached right now, so these events are examples, not
            real plans.
          </p>
        </div>
      )}









      <section className="shell sec">
        <SectionHeader index={no()} kicker={`This week in ${city.name}`} title="Headliners" href="/explore?when=week" />
        {pool.loading ? (
          <div className="feature-grid">
            <CardSkeleton variant="featured" />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : featured.length === 0 ? (
          <EmptyState
            title={`Nothing listed in ${city.name} yet`}
            body="New listings arrive every six hours."
          >
            <Link href="/explore" className="btn btn-primary">Browse every listing</Link>
            <TryElsewhere city={city} />
          </EmptyState>
        ) : (
          <div className="feature-grid">
            {featured.map((e, i) => (
              <EventCard key={e.id} event={e} variant={i === 0 ? "featured" : "standard"} priority={i === 0} />
            ))}
          </div>
        )}
      </section>
      {soon.length > 0 && (
        <section className="shell sec">
          <SectionHeader
            index={no()}
            kicker={<><span className="live-dot" aria-hidden="true" /> Next 3 hours</>}
            title="Boarding now"
            href="/explore?when=today&sort=soonest"
            linkLabel="All of today"
          />
          <RailOf events={soon.map((s) => s.event)} badges={soonBadges} label="events on now or starting soon" loading={false} />
        </section>
      )}
      <section className="shell sec">
        <SectionHeader index={no()} kicker="Every category, one line each" title="Browse by line" href="/explore" linkLabel="Browse everything" />
        <CategoryLines cats={lines} stat={lineStat} city={city.name} />
      </section>
      <WhenNear>
      {!pool.loading && all.length > 0 && (
        <section className="shell sec">
          <SectionHeader index={no()} kicker="Plans, not genres" title="Collections" href="/explore" linkLabel="Browse everything" />
          <Collections events={all} exclude={collectionExclude} />
        </section>
      )}
      {!pool.loading && <WeekendStories events={reelPool} city={city.name} />}
      {weekend.length > 0 && (
        <section className="shell sec">
          <SectionHeader index={no()} kicker="Saturday and Sunday" title="This weekend" href="/explore?when=weekend" />
          <RailOf events={weekend} label="weekend events" loading={false} />
        </section>
      )}
      {free.length > 0 && (
        <section className="shell sec">
          <SectionHeader index={no()} kicker="No ticket needed" title="Free entry" href="/explore?price=free" />
          <RailOf events={free} label="free events" loading={false} />
        </section>
      )}
      {(pool.loading || thisWeek.length > 0) && (
        <section className="shell sec">
          <SectionHeader index={no()} kicker="Next 7 days" title="This week" href="/explore?when=week" />
          <RailOf events={thisWeek} label="events this week" loading={pool.loading} />
        </section>
      )}
      <section className="shell sec">
        <SectionHeader
          index={no()}
          kicker="From what you saved"
          title="Handpicked for you"
          href={saved.length ? "/saved" : undefined}
          linkLabel="Your saved events"
        />
        {picks.length > 0 ? (
          <RailOf events={picks} label="picks for you" loading={false} />
        ) : (
          <div className="handpick-empty">
            <p className="handpick-empty-title">
              {saved.length === 0 ? "Nothing saved yet." : `Nothing new in ${city.name} like your saved events.`}
            </p>
            <p>
              {saved.length === 0
                ? "Tap the bookmark on any ticket. This line fills with more of the same kind, in your city."
                : "New listings arrive every six hours; this line updates with them."}
            </p>
            <Link href="/explore" className="link-arrow">
              Browse every listing
            </Link>
          </div>
        )}
      </section>

      </WhenNear>

      <SiteFooter />
    </>
  );
}
