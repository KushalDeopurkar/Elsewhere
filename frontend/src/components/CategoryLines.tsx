import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import type { CategoryPage } from "@/lib/categoryPages";
import { getCategoryColor } from "@/lib/categoryColors";
import CategoryIcon from "./CategoryIcon";

export interface LineStat {
  count: number | null;
  capped?: boolean;
}

/**
 * Categories as the lines of a transit map: one coloured line each, with how
 * many departures it has coming up in the city. Counts are only shown when
 * the listings answered; otherwise the line still opens its page.
 */
export default function CategoryLines({
  cats,
  stat,
  city,
}: {
  cats: CategoryPage[];
  stat: (value: CategoryPage["value"]) => LineStat | null;
  city: string;
}) {
  return (
    <ol className="lines">
      {cats.map((c) => {
        const s = stat(c.value);
        return (
          <li key={c.slug}>
            <Link
              href={`/categories/${c.slug}`}
              className="line"
              style={{ "--cat": getCategoryColor(c.value).color } as React.CSSProperties}
            >
              <span className="line-mark" aria-hidden="true">
                <CategoryIcon category={c.value} size={18} weight="bold" />
              </span>
              <span className="line-name">{c.label}</span>
              <span className="line-blurb">{c.blurb}</span>
              <span className="line-count">
                {s?.count != null ? (
                  <>
                    <strong>
                      {s.count}
                      {s.capped ? "+" : ""}
                    </strong>{" "}
                    <span className="sr-only">upcoming in {city}</span>
                  </>
                ) : null}
              </span>
              <ArrowRight className="line-go" size={16} weight="bold" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
