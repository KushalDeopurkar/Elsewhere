"use client";

import { useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "./icons";

/**
 * The primary search input.
 *
 * Deliberately described as keyword search. The backend is a Postgres
 * full-text index over title, description and venue — it is good at
 * "hackathon" or "jazz quartet", and it is not natural language. The
 * placeholder and helper text promise exactly that and nothing more.
 */
export default function SearchConsole({
  value,
  onSubmit,
  size = "large",
  autoFocus = false,
}: {
  value: string;
  onSubmit: (q: string) => void;
  size?: "large" | "compact";
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the field in step when the query changes elsewhere (a chip, a
  // category tile, the back button) without fighting the user mid-type.
  // Adjusting during render rather than in an effect avoids a second pass
  // that would briefly paint the stale value.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  return (
    <div className="console">
      <form
        className="console-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(draft.trim());
        }}
      >
        <div className="console-field">
          <SearchIcon size={size === "large" ? 20 : 18} className="console-icon" />
          <input
            ref={inputRef}
            type="search"
            className="console-input"
            value={draft}
            autoFocus={autoFocus}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Try “hackathon”, “yoga”, “jazz”, “startup”"
            aria-label="Search events by keyword"
            // Safari renders its own clear affordance for type=search; this
            // keeps the custom button as the single control.
            style={{ appearance: "none" }}
          />
          {draft && (
            <button
              type="button"
              className="console-clear"
              aria-label="Clear search"
              onClick={() => {
                setDraft("");
                onSubmit("");
                inputRef.current?.focus();
              }}
            >
              <CloseIcon />
            </button>
          )}
        </div>
        <button type="submit" className="console-submit">
          Search
        </button>
      </form>
      {size === "large" && (
        <p className="console-note">
          Keyword search across event titles, descriptions and venues.
        </p>
      )}
    </div>
  );
}
