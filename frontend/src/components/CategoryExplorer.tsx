"use client";

import { useState } from "react";
import { TAXONOMY, getFeaturedGroups } from "@/lib/taxonomy";
import { getCategoryPaint } from "@/lib/categoryColors";
import { ArrowRightIcon } from "./icons";

/**
 * Category discovery.
 *
 * Shows a curated handful and expands to the full taxonomy on request, so
 * the homepage never opens with fifteen large panels.
 */
export default function CategoryExplorer({
  onSelect,
}: {
  onSelect: (slug: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const groups = expanded ? TAXONOMY : getFeaturedGroups();

  return (
    <>
      <div className="category-grid">
        {groups.map((g) => {
          const paint = getCategoryPaint(g.category);
          return (
            <button
              key={g.slug}
              type="button"
              className="category-tile"
              style={{ "--tile-accent": paint.tileAccent } as React.CSSProperties}
              onClick={() => onSelect(g.slug)}
            >
              <span className="category-tile-label">{g.label}</span>
              <span className="category-tile-blurb">{g.blurb}</span>
              <ArrowRightIcon size={15} className="category-tile-arrow" />
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: "1rem" }}>
        <button
          type="button"
          className="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded
            ? "Show fewer categories"
            : `All ${TAXONOMY.length} categories`}
        </button>
      </div>
    </>
  );
}
