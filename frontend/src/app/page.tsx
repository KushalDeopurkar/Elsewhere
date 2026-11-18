"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass, BookmarkSimple } from "@phosphor-icons/react/ssr";
import KineticWord from "@/components/KineticWord";
import WeekendStories from "@/components/WeekendStories";
import { useSky } from "@/hooks/useSky";
import HeroSearch from "@/components/HeroSearch";
import DepartureBoard from "@/components/DepartureBoard";
import EventCard from "@/components/EventCard";
import Rail from "@/components/Rail";
import CategoryTile from "@/components/CategoryTile";
import SiteFooter from "@/components/SiteFooter";
import { SectionHeader, CardSkeleton, EmptyState } from "@/components/Section";
import { useCityEvents, useCategoryStats } from "@/hooks/useCityEvents";
import { useCity } from "@/lib/cityPref";
import { cityZone } from "@/lib/cities";
import { useSaved } from "@/lib/saved";
import { CATEGORY_PAGES } from "@/lib/categoryPages";
import { inDateWindow, sortEvents, upcoming, showcase, startingSoon } from "@/lib/eventFilters";
import type { Event } from "@/lib/types";

// Kept to roughly the width of "step out." so the headline stays on two lines.
const KINETIC = ["step out.", "show up.", "get lost.", "go out.", "say yes."];

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

  const statFor = (v: string) => stats?.find((s) => s.value === v);
  const tiles = CATEGORY_PAGES.filter((c) => c.value !== "other");

  return (
    <>
      <section className="home-hero has-board" data-sky={sky}>
        <div className="home-sky" aria-hidden="true" />
        <div className="shell home-hero-inner">
          <div className="home-hero-copy">
            <p className="eyebrow-live">
              <span className="live-dot" aria-hidden="true" />
              {pool.loading
                ? "Checking what's on"
                : sky === "night" || sky === "dusk"
                  ? `Tonight in ${city.name} · ${all.length}${all.length >= 100 ? "+" : ""} upcoming`
                  : `${all.length}${all.length >= 100 ? "+" : ""} upcoming in ${city.name}`}
            </p>
            <h1 className="home-title">
              Find your next reason to <span className="sr-only">step out.</span>
              <KineticWord words={KINETIC} />
            </h1>
            <p className="home-lede">
              Discover experiences, meet people, learn something new and explore what&apos;s happening around you.
            </p>
            <HeroSearch />
          </div>
          <div className="home-hero-art">
            <DepartureBoard events={all} city={city.name} zone={cityZone(city)} loading={pool.loading} night={sky === "night" || sky === "dusk"} />
          </div>
        </div>
      </section>

      {!pool.loading && <WeekendStories events={all} city={city.name} />}

      {pool.isSample && (
        <div className="shell">
          <p className="notice">Live data is unreachable right now, so these are sample events.</p>
        </div>
      )}

      <section className="shell sec">
        <SectionHeader kicker={`This week in ${city.name}`} title="Featured events" href="/explore?when=week" />
        {pool.loading ? (
          <div className="feature-grid">
            <CardSkeleton variant="featured" />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : featured.length === 0 ? (
          <EmptyState
            icon={<Compass size={30} weight="duotone" />}
            title={`Nothing listed in ${city.name} yet`}
            body="Try another city from the menu at the top, or explore everything."
          >
            <Link href="/explore" className="btn btn-primary">Explore events</Link>
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
            kicker={<><span className="live-dot" aria-hidden="true" /> Next 3 hours</>}
            title={`Happening now in ${city.name}`}
            href="/explore?when=today&sort=soonest"
            linkLabel="All of today"
          />
          <RailOf events={soon.map((s) => s.event)} badges={soonBadges} label="events on now or starting soon" loading={false} />
        </section>
      )}

      {(pool.loading || thisWeek.length > 0) && (
        <section className="shell sec">
          <SectionHeader title="Happening this week" href="/explore?when=week" />
          <RailOf events={thisWeek} label="events this week" loading={pool.loading} />
        </section>
      )}

      <section className="shell sec">
        <SectionHeader kicker="Every kind of event" title="Discover by category" href="/explore" linkLabel="Explore all" />
        <Rail label="categories" size="compact">
          {tiles.map((c) => {
            const s = statFor(c.value);
            return <CategoryTile key={c.slug} cat={c} image={s?.image} count={s?.count ?? null} capped={s?.capped} size="small" />;
          })}
        </Rail>
      </section>

      <section className="shell sec">
        <SectionHeader kicker="Based on what you saved" title="Handpicked for you" href={saved.length ? "/saved" : undefined} linkLabel="Your saved events" />
        {picks.length > 0 ? (
          <RailOf events={picks} label="picks for you" loading={false} />
        ) : (
          <div className="handpick-empty">
            <BookmarkSimple size={22} weight="duotone" aria-hidden="true" />
            <p>
              {saved.length === 0
                ? "Save a few events you like and this fills with more of the same kind."
                : `No new events in ${city.name} like the ones you saved yet.`}
            </p>
            <Link href="/explore" className="sec-link">Explore events <ArrowRight size={14} weight="bold" /></Link>
          </div>
        )}
      </section>

      {free.length > 0 && (
        <section className="shell sec">
          <SectionHeader kicker="No ticket needed" title="Free events" href="/explore?price=free" />
          <RailOf events={free} label="free events" loading={false} />
        </section>
      )}

      {weekend.length > 0 && (
        <section className="shell sec">
          <SectionHeader title="This weekend" href="/explore?when=weekend" />
          <RailOf events={weekend} label="weekend events" loading={false} />
        </section>
      )}

      <SiteFooter />
    </>
  );
}
