import { MagnifyingGlass, WarningCircle } from "@phosphor-icons/react/ssr";
import { Event } from "@/lib/types";
import EventCard from "./EventCard";

function Skeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton" key={i} aria-hidden="true">
          <div className="skeleton-fill" style={{ aspectRatio: "3 / 2" }} />
          <div style={{ padding: "0.95rem 1rem 1.1rem", display: "grid", gap: "0.5rem" }}>
            <div
              className="skeleton-fill"
              style={{ height: "0.6rem", width: "28%", borderRadius: 4 }}
            />
            <div
              className="skeleton-fill"
              style={{ height: "1rem", width: "88%", borderRadius: 4 }}
            />
            <div
              className="skeleton-fill"
              style={{ height: "0.8rem", width: "54%", borderRadius: 4 }}
            />
          </div>
        </div>
      ))}
    </>
  );
}

export default function EventGrid({
  events,
  loading,
  error,
  onRetry,
  onClear,
  variant = "results",
  skeletonCount = 8,
}: {
  events: Event[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClear?: () => void;
  variant?: "results" | "feature";
  skeletonCount?: number;
}) {
  const className = variant === "feature" ? "grid-feature" : "grid-results";

  if (loading) {
    return (
      <div className={className}>
        <Skeletons count={skeletonCount} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="panel is-error" role="alert">
          <WarningCircle size={32} weight="duotone" className="panel-icon" />
          <p className="panel-title">That search did not come back</p>
          <p className="panel-body">{error}</p>
          {onRetry && (
            <div className="panel-actions">
              <button type="button" className="btn btn-primary" onClick={onRetry}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={className}>
        <div className="panel">
          <MagnifyingGlass size={32} weight="duotone" className="panel-icon" />
          <p className="panel-title">Nothing matches those filters</p>
          <p className="panel-body">
            Widen the date range, or clear the category and search again.
          </p>
          {onClear && (
            <div className="panel-actions">
              <button type="button" className="btn btn-ghost" onClick={onClear}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {events.map((event, i) => (
        <EventCard key={event.id} event={event} priority={i < 3} />
      ))}
    </div>
  );
}
