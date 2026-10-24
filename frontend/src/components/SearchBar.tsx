"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react/ssr";

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Gigs, comedy, food, anything",
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
}) {
  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <div className="search-shell">
        <MagnifyingGlass size={19} weight="bold" className="search-icon" />
        <input
          type="search"
          className="search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Search events"
          enterKeyHint="search"
        />
        {value && (
          <button
            type="button"
            className="map-tool"
            style={{ width: "2rem", height: "2rem", borderRadius: "999px" }}
            onClick={() => onChange("")}
            aria-label="Clear search"
          >
            <X size={14} weight="bold" />
          </button>
        )}
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </div>
    </form>
  );
}
