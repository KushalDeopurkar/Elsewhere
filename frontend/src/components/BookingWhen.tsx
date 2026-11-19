import { hasTime } from "@/lib/formatDate";

const part = (iso: string, zone: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: zone, ...o }).format(new Date(iso));

/**
 * The boarding-pass block: the day and the departure time set large, the way
 * a pass prints its gate and time. Times are local to the event's city.
 */
export default function BookingWhen({ start, end, zone }: { start: string; end?: string | null; zone: string }) {
  const timed = hasTime(start, zone);
  const dow = part(start, zone, { weekday: "short" }).toUpperCase();
  const day = part(start, zone, { day: "2-digit" });
  const mon = part(start, zone, { month: "short" }).toUpperCase();
  const time = timed ? part(start, zone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : null;
  const sameDay = end ? part(end, zone, { dateStyle: "short" }) === part(start, zone, { dateStyle: "short" }) : true;
  const until =
    end && timed
      ? `${sameDay ? "" : `${part(end, zone, { weekday: "short" }).toUpperCase()} `}${part(end, zone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`
      : null;
  return (
    <div className="bw" aria-hidden="true">
      <div className="bw-cell">
        <span className="bw-label">Date</span>
        <span className="bw-big">{day}</span>
        <span className="bw-small">
          {dow} {mon}
        </span>
      </div>
      <div className="bw-cell">
        <span className="bw-label">Departs</span>
        <span className="bw-big">{time ?? "All day"}</span>
        <span className="bw-small">{until ? `until ${until}` : "local time"}</span>
      </div>
    </div>
  );
}
