"use client";

import { X, Info, Sparkle } from "@phosphor-icons/react/ssr";
import EventCard from "./EventCard";
import EventGrid from "./EventGrid";
import { Event } from "@/lib/types";
import { Intent, Signal, groupResults } from "@/lib/intent";

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
}: {
  intent: Intent;
  events: Event[];
  loading: boolean;
  isSample: boolean;
  onDropSignal: (s: Signal) => void;
  onClear: () => void;
}) {
  const { best, groups, total } = groupResults(events, intent);

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
          Matched on keywords and dates, not a language model.
          {intent.unsupported.length > 0 && (
            <>
              {" "}
              <Info size={12} weight="fill" style={{ verticalAlign: "-1px" }} /> No data for{" "}
              {intent.unsupported.join(" or ")} yet, so that part was ignored.
            </>
          )}
        </p>
      </div>

      {loading ? (
        <EventGrid events={[]} loading variant="feature" skeletonCount={3} />
      ) : total === 0 ? (
        <EventGrid events={[]} onClear={onClear} />
      ) : (
        <>
          <div className="section-head" style={{ marginTop: "2rem" }}>
            <h2>Best matches</h2>
            <span className="section-link mono">
              {total} event{total === 1 ? "" : "s"}
            </span>
          </div>
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
