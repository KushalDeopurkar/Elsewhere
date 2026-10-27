"use client";

import Link from "next/link";
import { COLLECTIONS } from "@/lib/collections";
import { ArrowRightIcon } from "./icons";

/**
 * Editorial collections.
 *
 * Curation here is the framing, not the contents: each card is a written
 * angle on the index that links straight into the real feed with the filters
 * it describes already applied.
 */
export default function CollectionRow() {
  return (
    <div className="collection-row scrollbar-hide">
      {COLLECTIONS.map((c) => (
        <Link
          key={c.slug}
          href={c.href}
          className="collection"
          style={
            {
              "--col-a": `oklch(0.58 0.15 ${c.hue})`,
              "--col-b": `oklch(0.32 0.11 ${c.hue})`,
            } as React.CSSProperties
          }
        >
          <span className="collection-wash" aria-hidden="true" />
          <span className="collection-body">
            <span className="collection-title display">{c.title}</span>
            <span className="collection-blurb">{c.blurb}</span>
          </span>
          <span className="collection-go" aria-hidden="true">
            <ArrowRightIcon size={15} />
          </span>
        </Link>
      ))}
    </div>
  );
}
