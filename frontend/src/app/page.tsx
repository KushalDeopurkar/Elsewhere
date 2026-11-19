"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WeekendStories from "@/components/WeekendStories";
import { useSky } from "@/hooks/useSky";
import HeroSearch from "@/components/HeroSearch";
import Timetable from "@/components/Timetable";
import EventCard from "@/components/EventCard";
import Rail from "@/components/Rail";
import CategoryLines from "@/components/CategoryLines";
import SiteFooter from "@/components/SiteFooter";
import { SectionHeader, CardSkeleton, EmptyState } from "@/components/Section";
import { useCityEvents, useCategoryStats } from "@/hooks/useCityEvents";
import { useCity } from "@/lib/cityPref";
import { cityZone } from "@/lib/cities";
import { useSaved } from "@/lib/saved";
import { CATEGORY_PAGES } from "@/lib/categoryPages";
import { inDateWindow, sortEvents, upcoming, showcase, startingSoon } from "@/lib/eventFilters";
import type { Event } from "@/lib/types";

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
  const sky = useSky();
  const night = sky === "night" || sky === "dusk";

  // Old shared plan links were /?plan=…; the planner now has its own page.
  useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get("plan");
    if (plan) router.replace(`/plan-my-day?plan=${encodeURIComponent(plan)}`);
  }, [router]);

  const pool = useCityEvents(city, { limit: 100 });
  const stats = useCategoryStats(city.name);

  const all = useMemo(() => upcoming(pool.events), [pool.events]);
  const featured = useMemo(() => {
    const week = showcase(all).filter((e) => inDateWindow(e, "week"));
    return (week.length >= 3 ? week : showcase(all)).slice(0, 3);
  }, [all]);
  const featuredIds = new Set(featured.map((e) => e.id));
  const notFeatured = all.filter((e) => !featuredIds.has(e.id));

  const soon = useMemo(() => startingSoon(all).slice(0, 12), [all]);
  const soonBadges = new Map(soon.map((s) => [s.event.id, s.badge]));

  const thisWeek = sortEvents(notFeatured.filter((e) => inDateWindow(e, "week")), "soonest").slice(0, 14);
  const free = sortEvents(all.filter((e) => e.is_free), "soonest").slice(0, 14);
  const weekend = sortEvents(all.filter((e) => inDateWindow(e, "weekend")), "soonest").slice(0, 14);
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

  const lines = CATEGORY_PAGES.filter((c) => c.value !== "other");
  const lineStat = (v: string) => {
    const s = stats?.find((x) => x.value === v);
    return s ? { count: s.count ?? null, capped: s.capped } : null;
  };
  const freeCount = all.filter((e) => e.is_free).length;

  return (
    <>
      <div className="shell home-top">
        <Timetable
          events={all}
          city={city.name}
          zone={cityZone(city)}
          loading={pool.loading}
          night={night}
          aside={
            <>
              <p className="home-lede">
                Every gig, workshop, match, meetup and free walk in {city.name}, gathered from across the web and set out
                like a timetable. Soonest first.
              </p>
              <HeroSearch />
              {(pool.loading || all.length > 0) && (
                <dl className="home-facts" aria-busy={pool.loading}>
                  <div>
                    <dt>Upcoming</dt>
                    <dd>{pool.loading ? "–" : `${all.length}${all.length >= 100 ? "+" : ""}`}</dd>
                  </div>
                  <div>
                    <dt>Free entry</dt>
                    <dd>{pool.loading ? "–" : freeCount}</dd>
                  </div>
                  <div>
                    <dt>Next 3 hours</dt>
                    <dd>{pool.loading ? "–" : soon.length}</dd>
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

      {!pool.loading && <WeekendStories events={all} city={city.name} />}

      <section className="shell sec">
        <SectionHeader index="01" kicker={`This week in ${city.name}`} title="Headliners" href="/explore?when=week" />
        {pool.loading ? (
          <div className="feature-grid">
            <CardSkeleton variant="featured" />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : featured.length === 0 ? (
          <EmptyState
            title={`Nothing listed in ${city.name} yet`}
            body="New listings arrive every six hours. Try another city from the header, or browse everything."
          >
            <Link href="/explore" className="btn btn-primary">Browse every listing</Link>
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
            index="02"
            kicker={<><span className="live-dot" aria-hidden="true" /> Next 3 hours</>}
            title="Boarding now"
            href="/explore?when=today&sort=soonest"
            linkLabel="All of today"
          />
          <RailOf events={soon.map((s) => s.event)} badges={soonBadges} label="events on now or starting soon" loading={false} />
        </section>
      )}

      {(pool.loading || thisWeek.length > 0) && (
        <section className="shell sec">
          <SectionHeader index="03" kicker="Next 7 days" title="This week" href="/explore?when=week" />
          <RailOf events={thisWeek} label="events this week" loading={pool.loading} />
        </section>
      )}

      <section className="shell sec">
        <SectionHeader index="04" kicker="Every kind of event" title="Lines" href="/explore" linkLabel="Browse everything" />
        <CategoryLines cats={lines} stat={lineStat} city={city.name} />
      </section>

      <section className="shell sec">
        <SectionHeader
          index="05"
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

      {free.length > 0 && (
        <section className="shell sec">
          <SectionHeader index="06" kicker="No ticket needed" title="Free entry" href="/explore?price=free" />
          <RailOf events={free} label="free events" loading={false} />
        </section>
      )}

      {weekend.length > 0 && (
        <section className="shell sec">
          <SectionHeader index="07" kicker="Saturday and Sunday" title="This weekend" href="/explore?when=weekend" />
          <RailOf events={weekend} label="weekend events" loading={false} />
        </section>
      )}

      <SiteFooter />
    </>
  );
}
