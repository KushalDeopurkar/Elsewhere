import Link from "next/link";
import type { CategoryPage } from "@/lib/categoryPages";
import { getCategoryColor } from "@/lib/categoryColors";
import CategoryIcon from "./CategoryIcon";

/**
 * A category as a tall tile. The picture is a real upcoming event from that
 * category when one exists; otherwise a tinted tile with the category icon.
 */
export default function CategoryTile({
  cat,
  image,
  count,
  size = "standard",
}: {
  cat: CategoryPage;
  image?: string | null;
  count?: number | null;
  size?: "standard" | "small";
}) {
  const hue = getCategoryColor(cat.value);
  return (
    <Link
      href={`/categories/${cat.slug}`}
      className={`ctile ctile-${size}`}
      style={{ "--cat-hue": hue.color, "--cat-wash": hue.wash } as React.CSSProperties}
    >
      {image ? (
        <img className="ctile-img" src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      ) : (
        <span className="ctile-art" aria-hidden="true">
          <CategoryIcon category={cat.value} size={56} />
        </span>
      )}
      <span className="ctile-scrim" aria-hidden="true" />
      <span className="ctile-body">
        <span className="ctile-icon"><CategoryIcon category={cat.value} size={18} weight="fill" /></span>
        <span className="ctile-label">{cat.label}</span>
        {size === "standard" && <span className="ctile-blurb">{cat.blurb}</span>}
        {count != null && <span className="ctile-count">{count} upcoming</span>}
      </span>
    </Link>
  );
}
