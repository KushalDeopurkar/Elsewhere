import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEvent } from "@/lib/api";
import { categoryLabel } from "@/lib/types";
import { getCategoryPaint } from "@/lib/categoryColors";
import { formatFullDateTime } from "@/lib/formatDate";
import { joinPlaceParts } from "@/lib/place";
import SaveButton from "@/components/SaveButton";
import {
  ArrowLeftIcon,
  ExternalIcon,
  GlobeIcon,
  PinIcon,
} from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id).catch(() => null);
  if (!event) return { title: "Event not found — EventEngine" };
  return {
    title: `${event.title} — EventEngine`,
    description: event.description?.slice(0, 160) ?? undefined,
  };
}

/**
 * Price.
 *
 * Says only what the record contains: free, a real figure or range, or
 * "check the listing". It never implies a price that was never captured.
 */
function priceText(event: {
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
}): string {
  if (event.is_free) return "Free to attend";
  const { price_min: min, price_max: max } = event;
  if (min == null && max == null) return "Check the listing";
  if (min != null && max != null && min !== max) return `${min} – ${max}`;
  return String(min ?? max);
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) notFound();

  const paint = getCategoryPaint(event.category);
  const hasImage = Boolean(event.image_url);

  const locationLine = event.is_online
    ? "Online event"
    : joinPlaceParts([event.location_name, event.address, event.city]);

  return (
    <article>
      {hasImage && (
        <div className="detail-hero">
          {/* Third-party image host; see EventCard for why this stays <img>. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.image_url!} alt="" />
          <div className="detail-hero-scrim" aria-hidden="true" />
          <Link href="/" className="backlink backlink-floating">
            <ArrowLeftIcon size={14} />
            All events
          </Link>
        </div>
      )}

      <div className="detail-shell">
        {!hasImage && (
          <div style={{ paddingTop: "2rem" }}>
            <Link href="/" className="backlink">
              <ArrowLeftIcon size={14} />
              All events
            </Link>
          </div>
        )}

        <header className={`detail-head${hasImage ? "" : " detail-head-noimage"}`}>
          <div className="detail-kicker">
            <span className="card-kicker micro">
              <span
                className="chip-dot"
                style={{ background: paint.marker }}
                aria-hidden="true"
              />
              {categoryLabel(event.category)}
            </span>
            {event.is_free && <span className="badge badge-free">Free</span>}
            {event.is_online && <span className="badge badge-online">Online</span>}
          </div>

          <h1 className="detail-title">{event.title}</h1>

          <div className="detail-actions">
            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-primary"
              >
                View listing on {event.source}
                <ExternalIcon size={14} />
              </a>
            )}
            <SaveButton eventId={event.id} title={event.title} />
            {event.lat != null && event.lng != null && (
              <Link href="/map" className="button">
                <PinIcon size={14} />
                See on map
              </Link>
            )}
          </div>
        </header>

        <dl className="facts">
          <div className="fact">
            <dt className="fact-label micro">When</dt>
            <dd className="fact-value numeric">
              {formatFullDateTime(event.start_time)}
              {event.end_time && (
                <>
                  <br />
                  <span className="meta">
                    until {formatFullDateTime(event.end_time)}
                  </span>
                </>
              )}
            </dd>
          </div>

          {locationLine && (
            <div className="fact">
              <dt className="fact-label micro">Where</dt>
              <dd className="fact-value">
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4375rem",
                  }}
                >
                  {event.is_online ? <GlobeIcon /> : <PinIcon />}
                  {locationLine}
                </span>
                {event.distance_km != null && (
                  <span className="meta numeric">
                    {" "}
                    · {event.distance_km.toFixed(1)} km away
                  </span>
                )}
              </dd>
            </div>
          )}

          <div className="fact">
            <dt className="fact-label micro">Price</dt>
            <dd className="fact-value numeric">{priceText(event)}</dd>
          </div>

          <div className="fact">
            <dt className="fact-label micro">Source</dt>
            <dd className="fact-value">
              Listed on {event.source}
            </dd>
          </div>
        </dl>

        {event.description && (
          <section style={{ marginTop: "2.5rem" }}>
            <h2 className="detail-section-title">About this event</h2>
            <div className="prose-body">
              <p style={{ whiteSpace: "pre-line" }}>{event.description}</p>
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
