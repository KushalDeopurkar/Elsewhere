import { Event } from "@/lib/types";
import EventCard, { CardVariant } from "./EventCard";

export function SkeletonCard({ variant = "standard" }: { variant?: CardVariant }) {
  return (
    <div className={`skeleton-card card-${variant}`} aria-hidden="true">
      <div className="skeleton" style={{ aspectRatio: "16 / 10", borderRadius: 0 }} />
      <div style={{ padding: "1rem", display: "grid", gap: "0.625rem" }}>
        <div className="skeleton" style={{ height: 10, width: "32%" }} />
        <div className="skeleton" style={{ height: 17, width: "88%" }} />
        <div className="skeleton" style={{ height: 13, width: "52%" }} />
        <div className="skeleton" style={{ height: 13, width: "66%" }} />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="event-grid" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * Result grid.
 *
 * The first card is promoted to the featured variant only when there are
 * enough results for the wider tile not to unbalance the grid.
 */
export default function EventGrid({
  events,
  featureFirst = false,
}: {
  events: Event[];
  featureFirst?: boolean;
}) {
  const promote = featureFirst && events.length >= 3;
  return (
    <div className="event-grid">
      {events.map((event, i) => (
        <EventCard
          key={event.id}
          event={event}
          variant={promote && i === 0 ? "featured" : "standard"}
        />
      ))}
    </div>
  );
}
