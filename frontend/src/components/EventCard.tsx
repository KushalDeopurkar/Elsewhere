import Link from "next/link";
import { Event, categoryLabel } from "@/lib/types";
import { getCategoryPaint } from "@/lib/categoryColors";
import { formatEventDate, datestampParts } from "@/lib/formatDate";
import SaveButton from "./SaveButton";
import { GlobeIcon, PinIcon } from "./icons";

/**
 * standard — the general-purpose grid tile.
 * featured — wide editorial lead, display-serif title.
 * poster   — portrait artwork-led tile for rails; the image carries it.
 * compact  — dense row for map lists and tight spaces.
 */
export type CardVariant = "standard" | "featured" | "poster" | "compact";

/**
 * Generated art for events with no image.
 *
 * Typographic and category-tinted on purpose — an unrelated stock photograph
 * would misrepresent the event, and a broken image frame looks like a bug.
 */
function CardArt({ event }: { event: Event }) {
  const paint = getCategoryPaint(event.category);
  return (
    <div className="card-art" style={paint.art as React.CSSProperties} aria-hidden="true">
      <span className="card-art-label">{categoryLabel(event.category)}</span>
    </div>
  );
}

function Media({ event, variant }: { event: Event; variant: CardVariant }) {
  const stamp = datestampParts(event.start_time);
  return (
    <div className="card-media">
      {event.image_url ? (
        /* Event images come from arbitrary third-party hosts, so they stay
           plain <img>: next/image would need every CDN enumerated in
           remotePatterns and would fail closed on any new source. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={event.image_url} alt="" loading="lazy" decoding="async" />
      ) : (
        <CardArt event={event} />
      )}

      {(variant === "featured" || variant === "poster") && (
        <span className="datestamp" aria-hidden="true">
          <span className="datestamp-month">{stamp.month}</span>
          <span className="datestamp-day">{stamp.day}</span>
        </span>
      )}

      {variant !== "compact" && <SaveButton eventId={event.id} title={event.title} />}
    </div>
  );
}

/**
 * Price label.
 *
 * Only ever reports what the row actually contains. A paid event with no
 * price recorded says nothing rather than inventing a figure or implying
 * free admission.
 */
function priceBadge(event: Event) {
  if (event.is_free) return <span className="badge badge-free">Free</span>;
  if (event.price_min == null && event.price_max == null) return null;
  const min = event.price_min;
  const max = event.price_max;
  const text =
    min != null && max != null && min !== max
      ? `${min}–${max}`
      : `${min ?? max}`;
  return <span className="badge badge-price">{text}</span>;
}

export default function EventCard({
  event,
  variant = "standard",
}: {
  event: Event;
  variant?: CardVariant;
}) {
  const paint = getCategoryPaint(event.category);
  const where = event.is_online
    ? "Online"
    : event.location_name || event.city || null;

  return (
    <article className={`card card-${variant}`}>
      <Media event={event} variant={variant} />

      <div className="card-body">
        <p className="card-kicker micro">
          <span
            className="chip-dot"
            style={{ background: paint.marker }}
            aria-hidden="true"
          />
          {categoryLabel(event.category)}
        </p>

        <h3 className="card-title">
          <Link href={`/events/${event.id}`} className="card-link">
            {event.title}
          </Link>
        </h3>

        <p className="card-when numeric">{formatEventDate(event.start_time)}</p>

        {where && (
          <p className="card-where">
            {event.is_online ? <GlobeIcon /> : <PinIcon />}
            <span>{where}</span>
          </p>
        )}

        {variant === "featured" && event.description && (
          <p className="card-blurb">{event.description}</p>
        )}

        <div className="card-foot">
          {priceBadge(event)}
          {event.is_online && <span className="badge badge-online">Online</span>}
          {event.distance_km != null && !event.is_online && (
            <span className="badge badge-distance">
              {event.distance_km < 1
                ? "Under 1 km"
                : `${event.distance_km.toFixed(1)} km`}
            </span>
          )}
          {variant === "compact" && (
            <span className="card-save-slot">
              <SaveButton eventId={event.id} title={event.title} size={14} />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
