import Link from "next/link";
import { notFound } from "next/navigation";
import { eventJsonLd, jsonLdHtml } from "@/lib/eventSchema";
import type { Metadata } from "next";
import { MapPin, ArrowSquareOut } from "@phosphor-icons/react/ssr";
import SiteFooter from "@/components/SiteFooter";
import SimilarEvents from "@/components/SimilarEvents";
import VenueEvents from "@/components/VenueEvents";
import EventImage from "@/components/EventImage";
import CategoryIcon from "@/components/CategoryIcon";
import { Breadcrumbs } from "@/components/Section";
import { EventActions, EventLocationMap } from "@/components/EventActions";
import { loadEvent } from "@/lib/eventServer";
import { CATEGORIES } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { agoLabel, formatFull, eventZone } from "@/lib/formatDate";
import { ticketState, priceLine, realTiers } from "@/lib/money";
import { categoryHref } from "@/lib/categoryPages";
import { Suspense } from "react";
import PosterTintStyle from "@/components/PosterTintStyle";
import TicketList from "@/components/TicketList";
import AboutText from "@/components/AboutText";
import TrailerMedia from "@/components/TrailerMedia";
import RevealTitle from "@/components/RevealTitle";
import { SalesCountdown, StartCountdown } from "@/components/LiveCountdown";
import PassportStamp from "@/components/PassportStamp";
import EventSocial from "@/components/EventSocial";
import EventActionBar from "@/components/EventActionBar";
import BookingWhen from "@/components/BookingWhen";
import { listingStatus } from "@/lib/eventFilters";

// Rendered on each request (similar events and live counts read fresh data,
// which a static page can't do). The event itself comes from a 5-minute
// data cache in getEvent, so repeat views stay quick.

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = await loadEvent(id);
  if (!event) return { title: "Event not found - Elsewhere" };
  const when = formatFull(event.start_time, eventZone(event));
  const place = [event.location_name, event.city].filter(Boolean).join(", ");
  return {
    title: `${event.title} - Elsewhere`,
    description: (event.description?.slice(0, 160) || [when, place].filter(Boolean).join(" · ")) ?? undefined,
    alternates: { canonical: `/events/${event.id}` },
    // Bundled sample listings (shown when the API is down) aren't real events.
    robots: event.source === "sample" ? { index: false } : undefined,
    // The share image comes from ./opengraph-image.tsx.
    twitter: { card: "summary_large_image" },
  };
}

const SOURCE_NAMES: Record<string, string> = {
  allevents: "AllEvents.in",
  district: "District",
  meetup: "Meetup",
  ticketmaster: "Ticketmaster",
  seatgeek: "SeatGeek",
  eventfinda: "Eventfinda",
  "paris-opendata": "Que faire à Paris",
  ics: "the organiser's calendar",
  football: "the club's site",
  sample: "Sample data",
};

/** Request time, for "sales end today" badges. Outside the component on purpose. */
function requestTime(): number {
  return Date.now();
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await loadEvent(id);
  if (!event) notFound();

  const meta = CATEGORIES.find((c) => c.value === event.category);
  const hue = getCategoryColor(event.category);
  const d = event.details ?? {};
  const tickets = realTiers(event.tickets, event.title);
  // Unknown price is not "free": only say so when the source does.
  const free = event.is_free || event.price_min === 0 || (tickets.length > 0 && tickets.every((t) => t.price === 0));
  const priceKnown = free || event.price_min != null || tickets.some((t) => t.price != null);
  const source = /^https:\/\/(www\.)?(luma\.com|lu\.ma)\//.test(event.url ?? "")
    ? "Luma"
    : (SOURCE_NAMES[event.source] ?? event.source);
  // Never promise tickets the listing says are gone; when it says nothing,
  // say "check" rather than "get".
  const state = ticketState({ title: event.title, tickets: event.tickets }, requestTime());
  const checked = event.details_fetched_at ? agoLabel(Date.parse(event.details_fetched_at), requestTime()) : null;
  const cta =
    state === "sold_out"
      ? free
        ? "Registration full · see the listing"
        : "Sold out · see the listing"
      : state === "closed"
        ? "Sales closed · see the listing"
        : free
          ? "Register"
          : state === "on_sale"
            ? tickets.length > 1
              ? `See all options on ${source}`
              : "Get tickets"
            : `Check tickets on ${source}`;
  const gone = state === "sold_out" || state === "closed";
  const where = [event.location_name, event.address || d.address].filter(Boolean).join(", ");
  const about = d.about && d.about.length > (event.description?.length ?? 0) ? d.about : event.description;
  const facts = [
    d.duration && { k: "Duration", v: d.duration },
    d.age && { k: "Age", v: d.age },
    d.language && { k: "Language", v: d.language },
    d.organizer && { k: "Organiser", v: d.organizer },
  ].filter(Boolean) as { k: string; v: string }[];
  const mapsUrl =
    event.lat != null && event.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}`
      : where
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`
        : null;

  return (
    <>
      {event.source !== "sample" && <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(eventJsonLd(event, about, d.organizer ?? null)) }}
      />}
      <article
        className="detail"
        data-ev={event.id}
        style={
          {
            "--cat-hue": hue.color,
            "--tint-glow": hue.wash,
            "--tint-wash": hue.wash,
          } as React.CSSProperties
        }
      >
        {/* Poster colour streams in after first paint; category colour until then. */}
        <PassportStamp event={event} />
        <EventActionBar
          event={event}
          price={priceLine(event)}
          ctaLabel={gone ? (state === "sold_out" ? "Sold out" : "Sales closed") : free ? "Register" : state === "on_sale" ? "Get tickets" : "Check tickets"}
        />
        <Suspense fallback={null}>
          <PosterTintStyle url={event.image_url} scope={event.id} />
        </Suspense>
        <div className="shell detail-top">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: meta?.label ?? "Events", href: categoryHref(event.category) },
              { label: event.title },
            ]}
          />
        </div>

        <div className="shell detail-hero">
          <header className="detail-head">
            <p className="detail-kicker">
              <span className="detail-line" aria-hidden="true">
                <CategoryIcon category={event.category} size={16} weight="bold" />
              </span>
              {meta?.label ?? event.category}
              {event.city ? <span className="detail-city">{event.city}</span> : null}
            </p>
            <RevealTitle className="detail-title" text={event.title} />
            <StartCountdown start={event.start_time} end={event.end_time} zone={eventZone(event)} />
            <ul className="detail-tags" aria-label="Tags">
              <li>{meta?.label ?? event.category}</li>
              {priceKnown && <li className={free ? "is-free" : undefined}>{free ? "Free" : "Paid"}</li>}
              {event.city && <li>{event.city}</li>}
              <li>via {source}</li>
              {listingStatus(event) && <li className="is-status">Listing says: {listingStatus(event)}</li>}
            </ul>
            <EventActions event={event} />
          </header>

          <div className="detail-stage">
            <TrailerMedia>
              <EventImage src={event.image_url} alt="" category={event.category} ratio="4 / 5" priority width={900} />
            </TrailerMedia>
          </div>
        </div>

        <div className="shell detail-grid">
          <div className="detail-main">
            <EventSocial event={event} />

            {about && (
              <section className="detail-section">
                <h2 className="detail-h2">About this event</h2>
                <AboutText text={about} />
              </section>
            )}

            {(facts.length > 0 || (d.notes?.length ?? 0) > 0) && (
              <section className="detail-section">
                <h2 className="detail-h2">Good to know</h2>
                {facts.length > 0 && (
                  <dl className="know">
                    {facts.map((f) => (
                      <div key={f.k}>
                        <dt>{f.k}</dt>
                        <dd>{f.v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {d.notes && d.notes.length > 0 && (
                  <ul className="know-notes">
                    {d.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section className="detail-section">
              <h2 className="detail-h2">Where</h2>
              {where ? <p className="detail-where">{where}</p> : <p className="muted">The listing doesn&apos;t give a venue.</p>}
              <EventLocationMap event={event} />
              {mapsUrl && (
                <a className="btn btn-ghost detail-directions" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  <MapPin size={16} weight="bold" /> Directions in Google Maps
                </a>
              )}
            </section>
          </div>

          <aside className="booking" aria-label="Tickets">
            <p className="booking-kicker">
              <span>Boarding pass</span>
              <span>{source}</span>
            </p>
            <BookingWhen start={event.start_time} end={event.end_time} zone={eventZone(event)} />
            <p className="booking-price">{priceLine(event)}</p>
            <dl className="booking-facts">
              <div>
                <dt>Starts</dt>
                <dd>{formatFull(event.start_time, eventZone(event))}</dd>
              </div>
              {event.end_time && (
                <div>
                  <dt>Ends</dt>
                  <dd>{formatFull(event.end_time, eventZone(event))}</dd>
                </div>
              )}
              {where && (
                <div>
                  <dt>Platform</dt>
                  <dd>{event.location_name || where}</dd>
                </div>
              )}
              <div>
                <dt>Entry</dt>
                <dd>{priceLine(event)}</dd>
              </div>
            </dl>
            <SalesCountdown tickets={tickets} />
            {tickets.length > 0 && (
              <TicketList tickets={tickets} fallbackUrl={event.url} sourceName={source} now={requestTime()} />
            )}
            {event.url ? (
              <a className={`btn ${gone ? "btn-ghost" : "btn-primary"} btn-lg booking-cta`} href={event.url} target="_blank" rel="noopener noreferrer">
                {cta}{" "}
                <ArrowSquareOut size={16} weight="bold" aria-hidden="true" />
                <span className="sr-only">(opens {source})</span>
              </a>
            ) : (
              <Link className="btn btn-ghost booking-cta" href="/map">Find it on the map</Link>
            )}
            {gone && (
              <p className="booking-gone" role="note">
                {state === "sold_out" ? "Sold out" : "Sales had closed"} when {source} was last checked
                {checked ? ` (${checked})` : ""}. Organisers sometimes release more, so the listing is still linked.
              </p>
            )}
            {!gone && checked && state === "on_sale" && (
              <p className="booking-checked">Tickets were on sale when last checked, {checked}.</p>
            )}
            <p className="booking-ref" aria-hidden="true">
              REF {event.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase()}
            </p>
            <p className="booking-note">
              {event.source === "sample"
                ? "Sample listing, not a real event."
                : `Tickets and registration are handled on ${source}. Check details there before you go.`}
              {event.source === "paris-opendata" && (
                <>
                  {" "}Listing from <a href="https://opendata.paris.fr/explore/dataset/que-faire-a-paris-/" target="_blank" rel="noopener noreferrer">Que faire à Paris</a>, Ville de Paris, under the{" "}
                  <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener noreferrer">ODbL</a>.
                </>
              )}
            </p>
          </aside>
        </div>
      </article>

      {/* Streamed after the event itself, so they never hold up the page. */}
      <Suspense fallback={null}>
        <VenueEvents event={event} />
      </Suspense>
      {event.source !== "sample" && (
        <Suspense fallback={null}>
          <SimilarEvents eventId={event.id} title={event.title} />
        </Suspense>
      )}
      <SiteFooter />
    </>
  );
}
