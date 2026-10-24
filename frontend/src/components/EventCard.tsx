import Link from "next/link";
import { MapPin, Clock } from "@phosphor-icons/react/ssr";
import { Event, CATEGORIES } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { formatDatePlate, formatWhen } from "@/lib/formatDate";
import { priceBadge } from "@/lib/money";

/**
 * Images come from arbitrary scraped hosts, so these are plain <img> rather
 * than next/image: a dead remote host degrades to an empty tile instead of
 * failing the optimizer. Layout shift is handled by aspect-ratio in CSS.
 */
export default function EventCard({
  event,
  priority = false,
}: {
  event: Event;
  priority?: boolean;
}) {
  const meta = CATEGORIES.find((c) => c.value === event.category);
  const hue = getCategoryColor(event.category);
  const plate = formatDatePlate(event.start_time);
  const price = priceBadge(event);

  return (
    <article className="card">
      <div className="card-media">
        {event.image_url && (
          <img
            src={event.image_url}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
          />
        )}
        <div className="card-date">
          <span className="card-date-day mono">{plate.day}</span>
          <span className="card-date-mon">{plate.month}</span>
        </div>
        <span className={`card-price mono${event.is_free ? " is-free" : ""}`}>
          {price}
        </span>
      </div>

      <div className="card-body">
        <p
          className="card-kicker"
          style={{ "--cat-hue": hue.color } as React.CSSProperties}
        >
          {meta?.label ?? event.category}
        </p>

        <h3 className="card-title">
          <Link href={`/events/${event.id}`} className="card-link">
            {event.title}
          </Link>
        </h3>

        <p className="card-time">
          <Clock size={14} weight="bold" style={{ verticalAlign: "-2px" }} />{" "}
          {formatWhen(event.start_time)}
        </p>

        {event.location_name && (
          <p className="card-foot">
            <MapPin size={14} weight="fill" />
            <span>
              {event.location_name}
              {event.city ? `, ${event.city}` : ""}
            </span>
          </p>
        )}
      </div>
    </article>
  );
}
