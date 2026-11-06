"use client";

import { X, Info, Sparkle } from "@phosphor-icons/react/ssr";
import EventCard from "./EventCard";
import EventGrid from "./EventGrid";
import { Event } from "@/lib/types";
import { Intent, Signal, groupResults } from "@/lib/intent";
import { matchesWindow } from "@/lib/formatDate";
import AlertButton from "./AlertButton";

export interface SemanticState {
  status: "loading" | "ok" | "off";
  events: Event[];
}

/**
 * Apply the hard constraints the person stated (day, free) to meaning-ranked
 * results. Place is already applied server-side as a radius around the city,
 * which is more reliable than scraped city names ("Bangalore" vs "Bengaluru").
 */
function keepStated(events: Event[], intent: Intent): Event[] {
  return events.filter(
    (e) => matchesWindow(e.start_time, intent.when) && (!intent.freeOnly || e.is_free),
  );
}

function Chip({ signal, onDrop }: { signal: Signal; onDrop: (s: Signal) => void }) {
  return (
    <span className="intent-chip">
      <span className="intent-chip-kind">{signal.kind}</span>
      {signal.label}
      <button type="button" onClick={() => onDrop(signal)} aria-label={`Remove ${signal.label}`}>
        <X size={11} weight="bold" />
      </button>
    </span>
  );
}

export default function IntentResults({
  intent,
  events,
  loading,
  isSample,
  onDropSignal,
  onClear,
  semantic,
  city,
}: {
  intent: Intent;
  events: Event[];
  loading: boolean;
  isSample: boolean;
  onDropSignal: (s: Signal) => void;
  onClear: () => void;
  semantic?: SemanticState;
  city?: string;
}) {
  const meaning = semantic?.status === "ok" ? keepStated(semantic.events, intent).slice(0, 6) : [];
  const shown = new Set(meaning.map((e) => e.id));
  const grouped = groupResults(
    events.filter((e) => !shown.has(e.id)),
    intent,
  );
  const best = grouped.best;
  const groups = grouped.groups;
  const total = grouped.total + meaning.length;

  return (
    <div className="shell section">
      <div className="intent-bar">
        {isSample && (
          <span className="sample-note" style={{ marginBottom: "0.75rem" }}>
            <Sparkle size={13} weight="fill" />
            Demo data, the live API is not connected
          </span>
        )}
        <p className="intent-read">
          Reading this as
          {intent.signals.length === 0 && <span className="intent-plain"> a keyword search</span>}
        </p>
        {intent.signals.length > 0 && (
          <div className="intent-chips">
            {intent.signals.map((s) => (
              <Chip key={`${s.kind}-${s.value}`} signal={s} onDrop={onDropSignal} />
            ))}
          </div>
        )}
        <p className="intent-note">
          {semantic?.status === "ok"
            ? "Top results are matched by meaning with AI embeddings; the rest use keywords and dates."
            : "Matched on keywords and dates."}
          {intent.unsupported.length > 0 && (
            <>
              {" "}
              <Info size={12} weight="fill" style={{ verticalAlign: "-1px" }} /> No data for{" "}
              {intent.unsupported.join(" or ")} yet, so that part was ignored.
            </>
          )}
        </p>
      </div>

      <div className="intent-alert">
        <AlertButton query={intent.text} city={city} hint="Get new matches for this search on Telegram or by email." />
      </div>

      {meaning.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: "2rem" }}>
            <h2>Closest in meaning</h2>
            <span className="section-link">AI match, beyond exact keywords</span>
          </div>
          <div className="grid-results">
            {meaning.map((event, i) => (
              <div key={event.id} className="reason-wrap">
                <EventCard event={event} priority={i < 3} />
                <ul className="reasons">
                  <li className="reason">Matched by meaning</li>
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      {semantic?.status === "loading" && (
        <p className="intent-note" style={{ marginTop: "1.5rem" }}>
          <Sparkle size={12} weight="fill" style={{ verticalAlign: "-1px" }} /> Finding events by meaning…
        </p>
      )}

      {loading ? (
        <EventGrid events={[]} loading variant="feature" skeletonCount={3} />
      ) : total === 0 && semantic?.status !== "loading" ? (
        <EventGrid events={[]} onClear={onClear} />
      ) : (
        <>
          {best.length > 0 && (
          <div className="section-head" style={{ marginTop: "2rem" }}>
            <h2>{meaning.length ? "Keyword matches" : "Best matches"}</h2>
            <span className="section-link mono">
              {total} event{total === 1 ? "" : "s"}
            </span>
          </div>
          )}
          <div className="grid-results">
            {best.map(({ event, reasons }) => (
              <div key={event.id} className="reason-wrap">
                <EventCard event={event} priority />
                <ul className="reasons">
                  {reasons.slice(0, 3).map((r) => (
                    <li key={r} className="reason">{r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {groups.map((g) => (
            <section key={g.key} style={{ marginTop: "2.75rem" }}>
              <div className="section-head">
                <h2>{g.title}</h2>
              </div>
              <div className="grid-results">
                {g.items.map(({ event }) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
