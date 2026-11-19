import TransitionLink from "./TransitionLink";
import { Event, CATEGORIES } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { eventZone, whenOf, timedOf } from "@/lib/formatDate";
import { priceBadge, realTiers } from "@/lib/money";
import { listingStatus } from "@/lib/eventFilters";
import EventImage from "./EventImage";
import SaveButton from "./SaveButton";

export type CardVariant = "standard" | "featured" | "compact" | "list";

const stubDate = (iso: string, zone: string) => {
  const d = new Date(iso);
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: zone, ...o }).format(d);
  return {
    dow: part({ weekday: "short" }).toUpperCase(),
    day: part({ day: "2-digit" }),
    month: part({ month: "short" }).toUpperCase(),
    time: part({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
};

/**
 * One event as a ticket: the poster, then a perforated stub with the date and
 * time set large, the line (category), the title and the venue. Four layouts:
 * - standard: rails and grids.
 * - featured: the wide headliner ticket, poster beside the stub.
 * - compact: a small row for side panels and dense lists.
 * - list: a wide row for Explore's list view.
 * The whole ticket is one link (a stretched pseudo-element on the title), with
 * the save button layered above it.
 */
export default function EventCard({
  event,
  priority = false,
  variant = "standard",
  badge,
  reasons,
}: {
  event: Event;
  priority?: boolean;
  variant?: CardVariant;
  /** Small marker such as "Starts in 20 min". Only for facts we know. */
  badge?: string;
  /** Why a search returned this event, in plain words ("Free to attend"). */
  reasons?: string[];
}) {
  const meta = CATEGORIES.find((c) => c.value === event.category);
  const hue = getCategoryColor(event.category);
  const zone = eventZone(event);
  const stub = stubDate(event.start_time, zone);
  const timed = timedOf(event);
  const price = priceBadge(event);
  // "Online, Online" reads as a bug: say a place once.
  const where = [...new Set([event.location_name, event.city].filter(Boolean))].join(", ");
  const tiers = realTiers(event.tickets, event.title).length;
  const status = listingStatus(event);
  const style = { "--cat": hue.color } as React.CSSProperties;
  const ratio = variant === "featured" ? "4 / 3" : variant === "list" ? "16 / 10" : "4 / 3";

  return (
    <article className={`ecard ecard-${variant}`} style={style}>
      <div className="ecard-media">
        <EventImage src={event.image_url} category={event.category} ratio={ratio} priority={priority} />
        {variant !== "compact" && (
          <span className={`ecard-price${event.is_free ? " is-free" : ""}`}>{price}</span>
        )}
      </div>

      <div className="ecard-body">
        <div className="ecard-when" aria-hidden="true">
          <span className="ecard-dow">{stub.dow}</span>
          <span className="ecard-day">{stub.day}</span>
          <span className="ecard-mon">{stub.month}</span>
          <span className="ecard-time">{timed ? stub.time : "All day"}</span>
        </div>
        <div className="ecard-text">
          <p className="ecard-kicker">
            <span className="ecard-line" aria-hidden="true" />
            {meta?.label ?? event.category}
            {status && <span className="ecard-status">{status}</span>}
            {badge && <span className="ecard-badge">{badge}</span>}
            {!badge && tiers > 1 && <span className="ecard-tiers">{tiers} ticket types</span>}
          </p>
          <h3 className="ecard-title">
            <TransitionLink kind="event" preview={event} href={`/events/${event.id}`} className="ecard-link" prefetch={false}>
              {event.title}
            </TransitionLink>
          </h3>
          <p className="ecard-meta">
            <span className="sr-only">When: </span>
            {whenOf(event)}
          </p>
          {where && (
            <p className="ecard-meta ecard-where">
              <span className="sr-only">Where: </span>
              <span className="ecard-ellipsis">{where}</span>
            </p>
          )}
          {reasons && reasons.length > 0 && (
            <p className="ecard-why">
              <span className="sr-only">Why it matches: </span>
              {reasons.slice(0, 3).join(" · ")}
            </p>
          )}
          {variant === "compact" && <span className={`ecard-price-inline${event.is_free ? " is-free" : ""}`}>{price}</span>}
          {(variant === "list" || variant === "featured") && event.description && (
            <p className="ecard-desc">{event.description.slice(0, 180)}</p>
          )}
        </div>
      </div>

      <div className="ecard-save">
        <SaveButton event={event} />
      </div>
    </article>
  );
}
