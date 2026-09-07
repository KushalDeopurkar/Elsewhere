import { Event } from "@/lib/types";
import EventCard from "./EventCard";

interface EventListProps {
  events: Event[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

function SkeletonCard({ withImage }: { withImage: boolean }) {
  return (
    <div className="skeleton-card">
      {withImage ? (
        <div className="skeleton-block" style={{ aspectRatio: "16 / 9" }} />
      ) : (
        <div className="skeleton-block" style={{ height: 8 }} />
      )}
      <div style={{ padding: "1.125rem" }}>
        <div className="skeleton-block" style={{ height: 20, width: "40%", borderRadius: 999, marginBottom: 12 }} />
        <div className="skeleton-block" style={{ height: 18, width: "85%", borderRadius: 6, marginBottom: 8 }} />
        <div className="skeleton-block" style={{ height: 14, width: "55%", borderRadius: 6, marginBottom: 10 }} />
        <div className="skeleton-block" style={{ height: 14, width: "70%", borderRadius: 6 }} />
      </div>
    </div>
  );
}

export default function EventList({ events, loading, error, onRetry }: EventListProps) {
  if (loading && events.length === 0) {
    return (
      <div className="event-grid" aria-busy="true" aria-live="polite">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} withImage={i % 3 !== 2} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="event-grid">
        <div className="state-panel is-error" role="alert">
          <p className="state-panel-title">Couldn&apos;t load events</p>
          <p className="state-panel-body">{error}</p>
          {onRetry && (
            <button type="button" className="retry-button" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="event-grid">
        <div className="state-panel">
          <p className="state-panel-title">No events match yet</p>
          <p className="state-panel-body">
            Try a broader search, clear the category filter, or check back — new events are added often.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="event-grid">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
