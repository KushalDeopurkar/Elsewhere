import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarBlank, MapPin, Ticket, ArrowSquareOut, Clock, Globe } from "@phosphor-icons/react/ssr";
import SiteFooter from "@/components/SiteFooter";
import SimilarEvents from "@/components/SimilarEvents";
import EventImage from "@/components/EventImage";
import CategoryIcon from "@/components/CategoryIcon";
import { Breadcrumbs } from "@/components/Section";
import { EventActions, EventLocationMap } from "@/components/EventActions";
import { getEvent } from "@/lib/api";
import { CATEGORIES } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { formatFull, eventZone } from "@/lib/formatDate";
import { priceLine, realTiers } from "@/lib/money";
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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found - Elsewhere" };
  return {
    title: `${event.title} - Elsewhere`,
    description: event.description?.slice(0, 160) ?? undefined,
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
  sample: "Sample data",
};

/** Request time, for "sales end today" badges. Outside the component on purpose. */
function requestTime(): number {
  return Date.now();
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const meta = CATEGORIES.find((c) => c.value === event.category);
  const hue = getCategoryColor(event.category);
  const d = event.details ?? {};
  const tickets = realTiers(event.tickets, event.title);
  // Unknown price is not "free": only say so when the source does.
  const free = event.is_free || event.price_min === 0 || (tickets.length > 0 && tickets.every((t) => t.price === 0));
  const priceKnown = free || event.price_min != null || tickets.some((t) => t.price != null);
  const where = [event.location_name, event.address || d.address].filter(Boolean).join(", ");
  const about = d.about && d.about.length > (event.description?.length ?? 0) ? d.about : event.description;
  const facts = [
    d.duration && { k: "Duration", v: d.duration },
    d.age && { k: "Age", v: d.age },
    d.language && { k: "Language", v: d.language },
    d.organizer && { k: "Organiser", v: d.organizer },
  ].filter(Boolean) as { k: string; v: string }[];
  const source = SOURCE_NAMES[event.source] ?? event.source;
  const mapsUrl =
    event.lat != null && event.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}`
      : where
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`
        : null;

  return (
    <>
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
          ctaLabel={free ? "Register" : "Get tickets"}
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

        <div className="shell detail-stage">
          <TrailerMedia>
            <EventImage src={event.image_url} alt="" category={event.category} ratio="21 / 9" priority />
          </TrailerMedia>
        </div>

        <div className="shell detail-grid">
          <div className="detail-main">
            <header className="detail-head">
              <p className="detail-kicker">
                <CategoryIcon category={event.category} size={15} />
                {meta?.label ?? event.category}
                {event.city ? <span> · {event.city}</span> : null}
              </p>
              <RevealTitle className="detail-title" text={event.title} />
              <StartCountdown start={event.start_time} end={event.end_time} zone={eventZone(event)} />
              <ul className="detail-tags" aria-label="Tags">
                <li>{meta?.label ?? event.category}</li>
                {priceKnown && <li className={free ? "is-free" : undefined}>{free ? "Free" : "Paid"}</li>}
                {event.city && <li>{event.city}</li>}
                <li>via {source}</li>
              </ul>
              <EventActions event={event} />
              <EventSocial event={event} />
            </header>

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

          <aside className="booking">
            <p className="booking-price">{priceLine(event)}</p>
            <dl className="booking-facts">
              <div>
                <dt><CalendarBlank size={16} weight="duotone" /> Starts</dt>
                <dd>{formatFull(event.start_time, eventZone(event))}</dd>
              </div>
              {event.end_time && (
                <div>
                  <dt><Clock size={16} weight="duotone" /> Ends</dt>
                  <dd>{formatFull(event.end_time, eventZone(event))}</dd>
                </div>
              )}
              {where && (
                <div>
                  <dt><MapPin size={16} weight="duotone" /> Venue</dt>
                  <dd>{event.location_name || where}</dd>
                </div>
              )}
              <div>
                <dt><Ticket size={16} weight="duotone" /> Entry</dt>
                <dd>{priceLine(event)}</dd>
              </div>
              <div>
                <dt><Globe size={16} weight="duotone" /> Source</dt>
                <dd>{source}</dd>
              </div>
            </dl>
            <SalesCountdown tickets={tickets} />
            {tickets.length > 0 && (
              <TicketList tickets={tickets} fallbackUrl={event.url} sourceName={source} now={requestTime()} />
            )}
            {event.url ? (
              <a className="btn btn-primary btn-lg booking-cta" href={event.url} target="_blank" rel="noopener noreferrer">
                {free ? "Register" : tickets.length > 1 ? `See all options on ${source}` : "Get tickets"}{" "}
                <ArrowSquareOut size={16} weight="bold" />
              </a>
            ) : (
              <Link className="btn btn-ghost booking-cta" href="/map">Find it on the map</Link>
            )}
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

      {event.source !== "sample" && <SimilarEvents eventId={event.id} title={event.title} />}
      <SiteFooter />
    </>
  );
}
