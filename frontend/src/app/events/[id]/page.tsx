import { getEvent } from "@/lib/api";
import { CATEGORIES } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { formatFullDateTime } from "@/lib/formatDate";
import Link from "next/link";
import { notFound } from "next/navigation";

const BackArrow = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

function CalendarIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3a9 9 0 100 18 9 9 0 000-18z" />
    </svg>
  );
}

const ExternalIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) notFound();

  const cat = CATEGORIES.find((c) => c.value === event.category);
  const colors = getCategoryColor(event.category);

  const priceLabel = event.is_free
    ? "Free"
    : event.price_min != null || event.price_max != null
      ? event.price_min === event.price_max
        ? `$${event.price_min}`
        : `$${event.price_min ?? 0}–${event.price_max ?? "?"}`
      : "See listing";

  return (
    <div>
      {event.image_url ? (
        <div className="detail-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.image_url} alt="" className="detail-hero-image" />
          <div className="detail-hero-overlay" />
          <Link href="/" className="back-link on-image">
            <BackArrow />
            Back to events
          </Link>
        </div>
      ) : null}

      <div className="container-page" style={{ maxWidth: "48rem", paddingBlock: "2rem 4rem" }}>
        {!event.image_url && (
          <Link href="/" className="back-link" style={{ marginBottom: "1.5rem" }}>
            <BackArrow />
            Back to events
          </Link>
        )}

        <div className="event-card-badges" style={{ marginTop: event.image_url ? "1.5rem" : 0, marginBottom: "0.75rem" }}>
          <span
            className="badge badge-category"
            style={{ "--cat-bg": colors.bg, "--cat-text": colors.text } as React.CSSProperties}
          >
            <span aria-hidden="true">{cat?.emoji}</span>
            {cat?.label || event.category}
          </span>
          {event.is_free && <span className="badge badge-free">Free</span>}
        </div>

        <h1 style={{ marginBottom: "0.5rem" }}>{event.title}</h1>

        <div className="info-grid">
          <div className="info-item">
            <span className="info-icon">
              <CalendarIcon />
            </span>
            <div>
              <p className="info-label">When</p>
              <p className="info-value">
                {formatFullDateTime(event.start_time)}
                {event.end_time && <> &ndash; {formatFullDateTime(event.end_time)}</>}
              </p>
            </div>
          </div>

          {event.location_name && (
            <div className="info-item">
              <span className="info-icon">
                <PinIcon />
              </span>
              <div>
                <p className="info-label">Where</p>
                <p className="info-value">
                  {event.location_name}
                  {event.address && `, ${event.address}`}
                </p>
              </div>
            </div>
          )}

          <div className="info-item">
            <span className="info-icon">
              <TagIcon />
            </span>
            <div>
              <p className="info-label">Price</p>
              <p className="info-value">{priceLabel}</p>
            </div>
          </div>
        </div>

        {event.description && (
          <div className="prose-body" style={{ marginBottom: "2rem" }}>
            <p style={{ whiteSpace: "pre-line" }}>{event.description}</p>
          </div>
        )}

        {event.url && (
          <a href={event.url} target="_blank" rel="noopener noreferrer" className="cta-button">
            View on {event.source}
            <ExternalIcon />
          </a>
        )}
      </div>
    </div>
  );
}
