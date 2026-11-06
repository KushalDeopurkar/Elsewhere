import Link from "next/link";
import { MapPin, Clock } from "@phosphor-icons/react/ssr";
import { Event, CATEGORIES } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { formatDatePlate, formatWhen } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";
import EventImage from "./EventImage";
import SaveButton from "./SaveButton";

export type CardVariant = "standard" | "featured" | "compact" | "list";

/**
 * One event, in four layouts:
 * - standard: grid and carousel card, 4:3 picture.
 * - featured: large editorial card, 16:9 picture with the text over a scrim.
 * - compact: small horizontal row for dense lists and side panels.
 * - list: wide row for Explore's list view.
 * The whole card is one link (a stretched pseudo-element on the title), with
 * the save button layered above it.
 */
export default function EventCard({
  event,
  priority = false,
  variant = "standard",
  badge,
}: {
  event: Event;
  priority?: boolean;
  variant?: CardVariant;
  /** Small marker such as "Free this week". Only for facts we know. */
  badge?: string;
}) {
  const meta = CATEGORIES.find((c) => c.value === event.category);
  const hue = getCategoryColor(event.category);
  const plate = formatDatePlate(event.start_time);
  const price = priceBadge(event);
  const where = [event.location_name, event.city].filter(Boolean).join(", ");
  const style = { "--cat-hue": hue.color } as React.CSSProperties;
  const ratio = variant === "featured" ? "16 / 9" : variant === "list" ? "16 / 10" : "4 / 3";

  return (
    <article className={`ecard ecard-${variant}`} style={style}>
      <div className="ecard-media">
        <EventImage
          src={event.image_url}
          category={event.category}
          ratio={ratio}
          priority={priority}
        />
        {variant !== "compact" && (
          <div className="ecard-plate" aria-hidden="true">
            <span className="ecard-plate-day">{plate.day}</span>
            <span className="ecard-plate-mon">{plate.month}</span>
          </div>
        )}
        {variant !== "compact" && (
          <span className={`ecard-price${event.is_free ? " is-free" : ""}`}>{price}</span>
        )}
      </div>

      <div className="ecard-body">
        <p className="ecard-kicker">
          {meta?.label ?? event.category}
          {badge && <span className="ecard-badge">{badge}</span>}
        </p>
        <h3 className="ecard-title">
          <Link href={`/events/${event.id}`} className="ecard-link" prefetch={false}>
            {event.title}
          </Link>
        </h3>
        <p className="ecard-meta">
          <Clock size={14} weight="bold" aria-hidden="true" />
          <span>{formatWhen(event.start_time)}</span>
        </p>
        {where && (
          <p className="ecard-meta">
            <MapPin size={14} weight="fill" aria-hidden="true" />
            <span className="ecard-ellipsis">{where}</span>
          </p>
        )}
        {variant === "compact" && <span className={`ecard-price-inline${event.is_free ? " is-free" : ""}`}>{price}</span>}
        {variant === "list" && event.description && (
          <p className="ecard-desc">{event.description.slice(0, 180)}</p>
        )}
      </div>

      <div className="ecard-save">
        <SaveButton event={event} />
      </div>
    </article>
  );
}
