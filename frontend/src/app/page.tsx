"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkle, ArrowRight, MapTrifold, Compass, BookmarkSimple } from "@phosphor-icons/react/ssr";
import HeroSearch from "@/components/HeroSearch";
import HeroDeck from "@/components/HeroDeck";
import EventCard from "@/components/EventCard";
import Rail from "@/components/Rail";
import CategoryTile from "@/components/CategoryTile";
import SiteFooter from "@/components/SiteFooter";
import { SectionHeader, CardSkeleton, EmptyState } from "@/components/Section";
import { useCityEvents, useCategoryStats } from "@/hooks/useCityEvents";
import { useCity } from "@/lib/cityPref";
import { useSaved } from "@/lib/saved";
import { CATEGORY_PAGES } from "@/lib/categoryPages";
import { inDateWindow, sortEvents, upcoming, showcase, startingSoon } from "@/lib/eventFilters";
import type { Event } from "@/lib/types";

const NOT_LEARNING_RE = /\b(comedy|stand.?up|brunch|party|dj|open mic)\b/i;
const LEARN_RE = /\b(workshops?|courses?|class(es)?|masterclass(es)?|bootcamps?|learn(ing)?|training|lectures?|seminars?|webinars?|tutorials?|study)\b/i;

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

  // Old shared plan links were /?plan=…; the planner now has its own page.
  useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get("plan");
    if (plan) router.replace(`/plan-my-day?plan=${encodeURIComponent(plan)}`);
  }, [router]);

  const pool = useCityEvents(city, { limit: 100 });
  const tech = useCityEvents(city, { category: "tech", limit: 30 });
  const biz = useCityEvents(city, { category: "business", limit: 20 });
  const edu = useCityEvents(city, { category: "education", limit: 30 });
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
  const nearby = sortEvents(notFeatured.filter((e) => e.distance_km != null), "distance").slice(0, 8);
  const free = sortEvents(all.filter((e) => e.is_free), "soonest").slice(0, 14);
  const weekend = sortEvents(all.filter((e) => inDateWindow(e, "weekend")), "soonest").slice(0, 14);
  const learn = useMemo(() => {
    // Scraped categories are noisy (a comedy night can land in "education"),
    // so the title has to read like learning too.
    const isLearning = (e: Event) => LEARN_RE.test(e.title) && !NOT_LEARNING_RE.test(e.title);
    return sortEvents(upcoming([...edu.events, ...all]).filter(isLearning), "soonest").slice(0, 14);
  }, [all, edu.events]);
  const scene = useMemo(
    () => sortEvents(upcoming([...tech.events, ...biz.events]), "soonest").slice(0, 14),
    [tech.events, biz.events],
  );

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
      <section className="home-hero">
        <div className="shell home-hero-inner">
          <div className="home-hero-copy">
            <p className="eyebrow-live">
              <span className="live-dot" aria-hidden="true" />
              {pool.loading ? "Checking what's on" : `${all.length}${all.length >= 100 ? "+" : ""} upcoming in ${city.name}`}
            </p>
            <h1 className="home-title">
              Find your next reason to <em>step out.</em>
            </h1>
            <p className="home-lede">
              Discover experiences, meet people, learn something new and explore what&apos;s happening around you.
            </p>
            <HeroSearch />
          </div>
          <div className="home-hero-art">
            <HeroDeck events={showcase(all)} />
          </div>
        </div>
      </section>

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

      {nearby.length > 0 && (
        <section className="shell sec">
          <SectionHeader kicker="Nearest first" title={`Close to you in ${city.name}`} href="/map" linkLabel="Open the map" />
          <div className="compact-grid">
            {nearby.map((e) => (
              <EventCard key={e.id} event={e} variant="compact" />
            ))}
          </div>
        </section>
      )}

      <section className="shell sec">
        <SectionHeader kicker="Every kind of event" title="Discover by category" href="/categories" linkLabel="All categories" />
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

      <section className="shell sec">
        <div className="plan-banner">
          <div>
            <p className="sec-kicker"><Sparkle size={14} weight="fill" /> AI day planner</p>
            <h2 className="plan-banner-title">Tell it your day. It builds the plan.</h2>
            <p className="plan-banner-body">
              “Saturday in Mumbai under ₹1500, tech then food then live music.” Real events, in an order you can make,
              with the route on a map.
            </p>
          </div>
          <Link href="/plan-my-day" className="btn btn-primary btn-lg">
            Plan my day <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
      </section>

      {weekend.length > 0 && (
        <section className="shell sec">
          <SectionHeader title="This weekend" href="/explore?when=weekend" />
          <RailOf events={weekend} label="weekend events" loading={false} />
        </section>
      )}

      {(edu.loading || learn.length > 0) && (
        <section className="shell sec">
          <SectionHeader kicker="Workshops, classes, talks" title="Learn something new" href="/categories/education" />
          <RailOf events={learn} label="learning events" loading={edu.loading && learn.length === 0} />
        </section>
      )}

      {(tech.loading || scene.length > 0) && (
        <section className="shell sec">
          <SectionHeader kicker="Hackathons, meetups, founders" title="Tech & startup scene" href="/categories/technology" />
          <RailOf events={scene} label="tech and startup events" loading={tech.loading && scene.length === 0} />
        </section>
      )}

      <section className="shell sec">
        <SectionHeader title="Explore more" />
        <div className="more-grid">
          <Link href="/explore" className="more-card">
            <Compass size={26} weight="duotone" />
            <span className="more-title">Explore everything</span>
            <span className="more-body">Search by meaning, filter by date, price and category.</span>
          </Link>
          <Link href="/map" className="more-card">
            <MapTrifold size={26} weight="duotone" />
            <span className="more-title">Browse the map</span>
            <span className="more-body">See what&apos;s on around you, street by street.</span>
          </Link>
          <Link href="/categories" className="more-card">
            <Sparkle size={26} weight="duotone" />
            <span className="more-title">All categories</span>
            <span className="more-body">From hackathons to half marathons.</span>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
