"use client";

import { CATEGORIES, EventCategory } from "@/lib/types";

interface CategoryFilterProps {
  selected: EventCategory | null;
  onSelect: (category: EventCategory | null) => void;
}

export default function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="category-scroll scrollbar-hide" role="tablist" aria-label="Filter by category">
      <button
        type="button"
        role="tab"
        aria-selected={selected === null}
        onClick={() => onSelect(null)}
        className={`category-pill${selected === null ? " is-active" : ""}`}
      >
        All
      </button>
      {CATEGORIES.map((cat) => (
        <button
          type="button"
          role="tab"
          aria-selected={selected === cat.value}
          key={cat.value}
          onClick={() => onSelect(selected === cat.value ? null : cat.value)}
          className={`category-pill${selected === cat.value ? " is-active" : ""}`}
        >
          <span aria-hidden="true">{cat.emoji}</span>
          {cat.label}
        </button>
      ))}
    </div>
  );
}
