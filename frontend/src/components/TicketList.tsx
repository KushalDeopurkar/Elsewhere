import { ArrowSquareOut } from "@phosphor-icons/react/ssr";
import type { Ticket } from "@/lib/types";
import { formatRupees } from "@/lib/money";

const DAY = 86_400_000;
const DATE = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

function salesNote(t: Ticket, now: number): { text: string; tone: "out" | "soon" | "info" } | null {
  if (t.available === false) return { text: "Sold out", tone: "out" };
  if (!t.sales_end) return null;
  const end = Date.parse(t.sales_end);
  if (!Number.isFinite(end)) return null;
  if (end < now) return { text: "Sales closed", tone: "out" };
  if (end - now < DAY) return { text: "Sales end today", tone: "soon" };
  if (end - now < 3 * DAY) return { text: `Sales end ${DATE.format(end)}`, tone: "soon" };
  return { text: `On sale till ${DATE.format(end)}`, tone: "info" };
}

function price(t: Ticket): string {
  if (t.price == null) return "Price on site";
  if (t.price === 0) return "Free";
  return t.currency && t.currency !== "INR" ? `${t.currency} ${t.price}` : formatRupees(t.price);
}

/**
 * Ticket tiers as the source lists them (GA, VIP, Early Bird...). Each row
 * books on the source site. Only shown when the source names its tiers.
 */
export default function TicketList({
  tickets,
  fallbackUrl,
  sourceName,
  now,
}: {
  tickets: Ticket[];
  fallbackUrl: string | null;
  sourceName: string;
  now: number;
}) {
  return (
    <section className="tickets" aria-labelledby="tickets-title">
      <h2 id="tickets-title" className="tickets-title">
        Tickets <span>{tickets.length} option{tickets.length === 1 ? "" : "s"}</span>
      </h2>
      <ul className="tickets-list">
        {tickets.map((t) => {
          const note = salesNote(t, now);
          const out = note?.tone === "out";
          const href = t.url || fallbackUrl;
          return (
            <li key={`${t.name}-${t.price}`} className={`ticket${out ? " is-out" : ""}`}>
              <div className="ticket-main">
                <span className="ticket-name">{t.name}</span>
                {note && <span className={`ticket-note is-${note.tone}`}>{note.text}</span>}
              </div>
              <span className="ticket-price">{price(t)}</span>
              {href && !out ? (
                <a className="ticket-book" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Book ${t.name} on ${sourceName}`}>
                  Book <ArrowSquareOut size={14} weight="bold" aria-hidden="true" />
                </a>
              ) : (
                <span className="ticket-book is-disabled" aria-hidden="true">
                  {t.available === false ? "Sold out" : out ? "Closed" : "On site"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="tickets-note">Prices and availability from {sourceName}; they can change. Fees may apply at checkout.</p>
    </section>
  );
}
