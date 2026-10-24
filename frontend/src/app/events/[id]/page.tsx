import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  CalendarBlank,
  MapPin,
  Ticket,
  ArrowSquareOut,
  Tag,
} from "@phosphor-icons/react/ssr";
import SiteFooter from "@/components/SiteFooter";
import { getEvent } from "@/lib/api";
import { CATEGORIES } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { formatFull } from "@/lib/formatDate";
import { priceLine } from "@/lib/money";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found - Pulse" };
  return {
    title: `${event.title} - Pulse`,
    description: event.description?.slice(0, 160) ?? undefined,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const meta = CATEGORIES.find((c) => c.value === event.category);
  const hue = getCategoryColor(event.category);
  const where = [event.location_name, event.address].filter(Boolean).join(", ");

  return (
    <>
      <header className="detail-hero">
        {event.image_url && (
          <img
            className="detail-hero-img"
            src={event.image_url}
            alt=""
            fetchPriority="high"
            decoding="async"
          />
        )}
        <div className="detail-hero-scrim" />

        <div className="shell detail-hero-inner">
          <Link href="/" className="back-link">
            <ArrowLeft size={15} weight="bold" />
            All events
          </Link>

          <h1 className="detail-title">{event.title}</h1>

          <p
            className="card-kicker"
            style={{
              "--cat-hue": hue.color,
              marginTop: "0.9rem",
            } as React.CSSProperties}
          >
            <Tag size={13} weight="fill" />
            {meta?.label ?? event.category}
            {event.city ? ` in ${event.city}` : ""}
          </p>
        </div>
      </header>

      <div className="shell detail-layout">
        <div>
          {event.description && <p className="prose">{event.description}</p>}

          <div className="fact-list" style={{ marginTop: "1.5rem" }}>
            <div className="fact">
              <span className="fact-icon">
                <CalendarBlank size={17} weight="duotone" />
              </span>
              <span>
                <span className="fact-label">Starts</span>
                <span className="fact-value">{formatFull(event.start_time)}</span>
              </span>
            </div>

            {event.end_time && (
              <div className="fact">
                <span className="fact-icon">
                  <CalendarBlank size={17} weight="duotone" />
                </span>
                <span>
                  <span className="fact-label">Ends</span>
                  <span className="fact-value">{formatFull(event.end_time)}</span>
                </span>
              </div>
            )}

            {where && (
              <div className="fact">
                <span className="fact-icon">
                  <MapPin size={17} weight="duotone" />
                </span>
                <span>
                  <span className="fact-label">Where</span>
                  <span className="fact-value">{where}</span>
                </span>
              </div>
            )}

            <div className="fact">
              <span className="fact-icon">
                <Ticket size={17} weight="duotone" />
              </span>
              <span>
                <span className="fact-label">Entry</span>
                <span className="fact-value">{priceLine(event)}</span>
              </span>
            </div>
          </div>
        </div>

        <aside className="booking">
          <p className="booking-price">{priceLine(event)}</p>
          <p className="booking-note">
            {event.source === "sample"
              ? "Sample listing, not a real event."
              : `Listed on ${event.source}.`}
          </p>

          {event.url ? (
            <a
              className="btn btn-primary"
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get tickets
              <ArrowSquareOut size={15} weight="bold" />
            </a>
          ) : (
            <Link className="btn btn-ghost" href="/map">
              Find it on the map
            </Link>
          )}
        </aside>
      </div>

      <SiteFooter />
    </>
  );
}
