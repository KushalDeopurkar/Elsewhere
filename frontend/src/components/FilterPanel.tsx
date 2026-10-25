"use client";

import { useState } from "react";
import {
  DATE_PRESETS,
  DatePreset,
  Filters,
  DEFAULT_RADIUS_KM,
  activeFilterCount,
} from "@/lib/filters";
import { CITIES, RADIUS_OPTIONS, requestCurrentPlace } from "@/lib/location";
import { TAXONOMY, getGroup } from "@/lib/taxonomy";
import { EventSort } from "@/lib/types";
import { CrosshairIcon } from "./icons";

/**
 * Advanced refinements, behind progressive disclosure.
 *
 * Only controls the API can honour appear here. There is no "sort by
 * popularity" or "trending" option because the schema records neither.
 */
export default function FilterPanel({
  filters,
  onChange,
  onReset,
  onClose,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const group = filters.group ? getGroup(filters.group) : undefined;

  async function useMyLocation() {
    setLocating(true);
    setLocationError(null);
    const outcome = await requestCurrentPlace();
    setLocating(false);
    if (outcome.ok) {
      onChange({ place: outcome.place });
    } else {
      setLocationError(outcome.reason);
    }
  }

  return (
    <div className="filter-panel" id="filter-panel">
      <div className="filter-group">
        <span className="filter-group-label micro" id="filter-category-label">
          Category
        </span>
        <div className="chip-row scrollbar-hide" aria-labelledby="filter-category-label">
          <button
            type="button"
            className="chip"
            aria-pressed={filters.group === null}
            onClick={() => onChange({ group: null, sub: null })}
          >
            Everything
          </button>
          {TAXONOMY.map((g) => (
            <button
              key={g.slug}
              type="button"
              className="chip"
              aria-pressed={filters.group === g.slug}
              onClick={() =>
                onChange(
                  filters.group === g.slug
                    ? { group: null, sub: null }
                    : { group: g.slug, sub: null }
                )
              }
            >
              {g.label}
            </button>
          ))}
        </div>

        {group && group.subcategories.length > 0 && (
          <>
            <span
              className="filter-group-label micro"
              id="filter-sub-label"
              style={{ marginTop: "1rem" }}
            >
              Within {group.label}
            </span>
            <div className="chip-row scrollbar-hide" aria-labelledby="filter-sub-label">
              {group.subcategories.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  className="chip"
                  aria-pressed={filters.sub === s.slug}
                  onClick={() =>
                    onChange({ sub: filters.sub === s.slug ? null : s.slug })
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="filter-group">
        <span className="filter-group-label micro" id="filter-date-label">
          When
        </span>
        <div className="chip-row scrollbar-hide" aria-labelledby="filter-date-label">
          {DATE_PRESETS.map((d) => (
            <button
              key={d.value}
              type="button"
              className="chip"
              aria-pressed={filters.date === d.value}
              onClick={() => onChange({ date: d.value as DatePreset })}
            >
              {d.label}
            </button>
          ))}
        </div>

        <span
          className="filter-group-label micro"
          style={{ marginTop: "1rem" }}
          id="filter-format-label"
        >
          Format
        </span>
        <div className="segmented" role="group" aria-labelledby="filter-format-label">
          <button
            type="button"
            aria-pressed={filters.online === null}
            onClick={() => onChange({ online: null })}
          >
            Any
          </button>
          <button
            type="button"
            aria-pressed={filters.online === false}
            onClick={() => onChange({ online: false })}
          >
            In person
          </button>
          <button
            type="button"
            aria-pressed={filters.online === true}
            onClick={() => onChange({ online: true })}
          >
            Online
          </button>
        </div>

        <span
          className="filter-group-label micro"
          style={{ marginTop: "1rem" }}
          id="filter-price-label"
        >
          Price
        </span>
        <div className="segmented" role="group" aria-labelledby="filter-price-label">
          <button
            type="button"
            aria-pressed={!filters.freeOnly}
            onClick={() => onChange({ freeOnly: false })}
          >
            Any price
          </button>
          <button
            type="button"
            aria-pressed={filters.freeOnly}
            onClick={() => onChange({ freeOnly: true })}
          >
            Free only
          </button>
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-group-label micro" id="filter-place-label">
          Where
        </span>
        <div className="chip-row scrollbar-hide" aria-labelledby="filter-place-label">
          <button
            type="button"
            className="chip"
            aria-pressed={filters.place === null}
            onClick={() => onChange({ place: null })}
          >
            Anywhere
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={filters.place?.label === "Near me"}
            onClick={useMyLocation}
            disabled={locating}
          >
            <CrosshairIcon />
            {locating ? "Locating…" : "Near me"}
          </button>
          {CITIES.map((c) => (
            <button
              key={c.label}
              type="button"
              className="chip"
              aria-pressed={filters.place?.label === c.label}
              onClick={() =>
                onChange({
                  place: filters.place?.label === c.label ? null : c,
                })
              }
            >
              {c.label}
            </button>
          ))}
        </div>
        {locationError && (
          <p className="location-note" role="status">
            {locationError}
          </p>
        )}

        {filters.place && (
          <>
            <label
              className="filter-group-label micro"
              htmlFor="radius-input"
              style={{ marginTop: "1rem" }}
            >
              Within {filters.radiusKm} km of {filters.place.label}
            </label>
            <div className="radius-row">
              <input
                id="radius-input"
                type="range"
                min={RADIUS_OPTIONS[0]}
                max={RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1]}
                step={5}
                value={filters.radiusKm}
                onChange={(e) => onChange({ radiusKm: Number(e.target.value) })}
              />
              <span className="meta numeric">{filters.radiusKm} km</span>
            </div>
          </>
        )}
      </div>

      <div className="filter-group">
        <label className="filter-group-label micro" htmlFor="sort-select">
          Sort
        </label>
        <select
          id="sort-select"
          className="select"
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as EventSort })}
        >
          <option value="relevance">Best match, then soonest</option>
          <option value="date">Soonest first</option>
          <option value="distance" disabled={!filters.place}>
            Nearest first{filters.place ? "" : " — needs a location"}
          </option>
        </select>
        <p className="console-note">
          {filters.sort === "relevance"
            ? "Keyword relevance applies when you've searched; otherwise soonest first."
            : filters.sort === "date"
              ? "Ordered by start time."
              : "Ordered by distance from your selected location."}
        </p>
      </div>

      <div className="filter-panel-footer">
        <button type="button" className="button button-primary" onClick={onClose}>
          Show results
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={onReset}
          disabled={activeFilterCount(filters) === 0 && filters.radiusKm === DEFAULT_RADIUS_KM}
        >
          Reset all
        </button>
      </div>
    </div>
  );
}
