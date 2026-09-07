import Link from "next/link";
import { Event, CATEGORIES } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { formatEventDate } from "@/lib/formatDate";

export default function EventCard({ event }: { event: Event }) {
  const cat = CATEGORIES.find((c) => c.value === event.category);
  const colors = getCategoryColor(event.category);

  return (
    <Link href={`/events/${event.id}`} className="event-card" aria-label={event.title}>
      {event.image_url ? (
        <div className="event-card-image-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url}
            alt=""
            className="event-card-image"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="event-card-strip" style={{ background: colors.accent }} />
      )}
      <div className="event-card-body">
        <div className="event-card-badges">
          <span className="badge badge-category" style={{ "--cat-bg": colors.bg, "--cat-text": colors.text } as React.CSSProperties}>
            <span aria-hidden="true">{cat?.emoji}</span>
            {cat?.label || event.category}
          </span>
          {event.is_free && <span className="badge badge-free">Free</span>}
        </div>

        <h3 className="event-card-title">{event.title}</h3>

        <p className="event-card-date">{formatEventDate(event.start_time)}</p>

        {event.location_name && (
          <p className="event-card-location">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{event.location_name}</span>
          </p>
        )}

        {event.distance_km != null && (
          <p className="event-card-distance">{event.distance_km.toFixed(1)} km away</p>
        )}
      </div>
    </Link>
  );
}
