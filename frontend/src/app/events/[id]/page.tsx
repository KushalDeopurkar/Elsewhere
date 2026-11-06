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
import { formatFull } from "@/lib/formatDate";
import { priceLine } from "@/lib/money";
import { categoryHref } from "@/lib/categoryPages";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found - EventEngine" };
  return {
    title: `${event.title} - EventEngine`,
    description: event.description?.slice(0, 160) ?? undefined,
    openGraph: event.image_url ? { images: [event.image_url] } : undefined,
  };
}

const SOURCE_NAMES: Record<string, string> = {
  allevents: "AllEvents.in",
  district: "District",
  meetup: "Meetup",
  sample: "Sample data",
};

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const meta = CATEGORIES.find((c) => c.value === event.category);
  const hue = getCategoryColor(event.category);
  const where = [event.location_name, event.address].filter(Boolean).join(", ");
  const source = SOURCE_NAMES[event.source] ?? event.source;
  const free = event.is_free || (event.price_min ?? 0) === 0;
  const mapsUrl =
    event.lat != null && event.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}`
      : where
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`
        : null;

  return (
    <>
      <article className="detail" style={{ "--cat-hue": hue.color } as React.CSSProperties}>
        <div className="shell detail-top">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: meta?.label ?? "Events", href: categoryHref(event.category) },
              { label: event.title },
            ]}
          />
        </div>

        <div className="shell detail-grid">
          <div className="detail-main">
            <div className="detail-media">
              <EventImage src={event.image_url} alt="" category={event.category} ratio="16 / 9" priority />
            </div>

            <header className="detail-head">
              <p className="detail-kicker">
                <CategoryIcon category={event.category} size={15} />
                {meta?.label ?? event.category}
                {event.city ? <span> · {event.city}</span> : null}
              </p>
              <h1 className="detail-title">{event.title}</h1>
              <ul className="detail-tags" aria-label="Tags">
                <li>{meta?.label ?? event.category}</li>
                <li className={free ? "is-free" : undefined}>{free ? "Free" : "Paid"}</li>
                {event.city && <li>{event.city}</li>}
                <li>via {source}</li>
              </ul>
              <EventActions event={event} />
            </header>

            {event.description && (
              <section className="detail-section">
                <h2 className="detail-h2">About this event</h2>
                <p className="prose">{event.description}</p>
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
                <dd>{formatFull(event.start_time)}</dd>
              </div>
              {event.end_time && (
                <div>
                  <dt><Clock size={16} weight="duotone" /> Ends</dt>
                  <dd>{formatFull(event.end_time)}</dd>
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
            {event.url ? (
              <a className="btn btn-primary btn-lg booking-cta" href={event.url} target="_blank" rel="noopener noreferrer">
                {free ? "Register" : "Get tickets"} <ArrowSquareOut size={16} weight="bold" />
              </a>
            ) : (
              <Link className="btn btn-ghost booking-cta" href="/map">Find it on the map</Link>
            )}
            <p className="booking-note">
              {event.source === "sample"
                ? "Sample listing, not a real event."
                : `Tickets and registration are handled on ${source}. Check details there before you go.`}
            </p>
          </aside>
        </div>
      </article>

      {event.source !== "sample" && <SimilarEvents eventId={event.id} title={event.title} />}
      <SiteFooter />
    </>
  );
}
