import Link from "next/link";
import { Event, categoryLabel } from "@/lib/types";
import { getCategoryPaint } from "@/lib/categoryColors";
import { joinPlaceParts } from "@/lib/place";
import SaveButton from "./SaveButton";
import { GlobeIcon, PinIcon } from "./icons";

/**
 * Dense, date-grouped listing.
 *
 * The counterpart to the card grid: a uniform grid is good for browsing
 * artwork but poor for answering "what is on, in order". This groups by
 * calendar day under sticky headers and reduces each event to one scannable
 * row — time, title, venue, price — so a long programme can be read at a
 * glance instead of scrolled through as tiles.
 */
function groupByDay(events: Event[]): { key: string; label: string; events: Event[] }[] {
  const groups = new Map<string, { label: string; events: Event[] }>();
  const now = new Date();
  const todayKey = now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toDateString();

  for (const event of events) {
    const d = new Date(event.start_time);
    const key = d.toDateString();
    if (!groups.has(key)) {
      const label =
        key === todayKey
          ? "Today"
          : key === tomorrowKey
            ? "Tomorrow"
            : d.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              });
      groups.set(key, { label, events: [] });
    }
    groups.get(key)!.events.push(event);
  }

  return [...groups.entries()].map(([key, v]) => ({ key, ...v }));
}

function time(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function priceLabel(event: Event): string | null {
  if (event.is_free) return "Free";
  const { price_min: min, price_max: max } = event;
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min}–${max}`;
  return String(min ?? max);
}

export default function ScheduleList({ events }: { events: Event[] }) {
  const groups = groupByDay(events);

  return (
    <div className="schedule">
      {groups.map((group) => (
        <section key={group.key} className="schedule-group">
          <h3 className="schedule-daymark">
            <span className="schedule-daymark-label">{group.label}</span>
            <span className="schedule-daymark-count numeric">
              {group.events.length}
            </span>
          </h3>

          <ul className="schedule-rows">
            {group.events.map((event) => {
              const paint = getCategoryPaint(event.category);
              const where = event.is_online
                ? "Online"
                : joinPlaceParts([event.location_name, event.city]);
              const price = priceLabel(event);

              return (
                <li key={event.id} className="schedule-row">
                  <span className="schedule-time numeric">
                    {time(event.start_time)}
                  </span>

                  <span className="schedule-main">
                    <span className="schedule-title">
                      <Link href={`/events/${event.id}`} className="card-link">
                        {event.title}
                      </Link>
                    </span>
                    <span className="schedule-meta">
                      <span
                        className="chip-dot"
                        style={{ background: paint.marker }}
                        aria-hidden="true"
                      />
                      {categoryLabel(event.category)}
                      {where && (
                        <>
                          <span className="schedule-sep" aria-hidden="true">
                            /
                          </span>
                          {event.is_online ? <GlobeIcon /> : <PinIcon />}
                          <span className="schedule-where">{where}</span>
                        </>
                      )}
                    </span>
                  </span>

                  <span className="schedule-tail">
                    {price && (
                      <span
                        className={`badge ${
                          event.is_free ? "badge-free" : "badge-price"
                        }`}
                      >
                        {price}
                      </span>
                    )}
                    {event.distance_km != null && !event.is_online && (
                      <span className="badge badge-distance">
                        {event.distance_km < 1
                          ? "<1 km"
                          : `${event.distance_km.toFixed(1)} km`}
                      </span>
                    )}
                    <SaveButton eventId={event.id} title={event.title} size={14} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
