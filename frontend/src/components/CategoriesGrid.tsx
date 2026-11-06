"use client";

import CategoryTile from "./CategoryTile";
import { CATEGORY_PAGES } from "@/lib/categoryPages";
import { useCity } from "@/lib/cityPref";
import { useCategoryStats } from "@/hooks/useCityEvents";

export default function CategoriesGrid() {
  const city = useCity();
  const stats = useCategoryStats(city.name);
  const tiles = CATEGORY_PAGES.map((c) => ({ c, s: stats?.find((x) => x.value === c.value) }));
  // Busiest first once counts arrive; the fixed order until then.
  if (stats) tiles.sort((a, b) => (b.s?.count ?? 0) - (a.s?.count ?? 0));
  return (
    <>
      <p className="cat-note">
        {stats ? `Counting upcoming events within 40 km of ${city.name}.` : `Counting events in ${city.name}…`}
      </p>
      <div className="cat-grid">
        {tiles.map(({ c, s }) => (
          <CategoryTile
            key={c.slug}
            cat={c}
            image={s?.image}
            count={s?.count ?? null}
            capped={s?.capped}
          />
        ))}
      </div>
    </>
  );
}
