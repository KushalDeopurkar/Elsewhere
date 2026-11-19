"use client";

import { useCallback, useState } from "react";
import type { EventCategory } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import CategoryIcon from "./CategoryIcon";
import { sized } from "@/lib/imageUrl";

/**
 * The one image component every event picture goes through.
 *
 * - A fixed aspect-ratio frame with overflow hidden, so nothing stretches or
 *   spills, whatever size the source is.
 * - Photographs fill the frame (object-fit: cover).
 * - Posters, which scrapers return in every shape, are detected on load: if
 *   the picture is much taller than the frame, cropping it would cut off the
 *   title and date printed on it, so it is shown whole (contain) over a
 *   blurred copy of itself instead of letterbox bars.
 * - Missing or broken images fall back to a category-tinted tile with the
 *   category's icon, never an empty grey box.
 */
export default function EventImage({
  src,
  alt = "",
  category,
  ratio = "4 / 3",
  priority = false,
  className = "",
  width = 360,
}: {
  src: string | null | undefined;
  alt?: string;
  category: EventCategory;
  /** CSS aspect-ratio, e.g. "16 / 9". */
  ratio?: string;
  priority?: boolean;
  className?: string;
  /** How wide it is drawn, in CSS pixels: the picture is fetched at that size. */
  width?: number;
}) {
  const [failed, setFailed] = useState(!src);
  // Resized copy first; if the resizer can't fetch it, the original once.
  const [useOriginal, setUseOriginal] = useState(false);
  const url = useOriginal ? src : sized(src, width);
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [w, h] = ratio.split("/").map((n) => Number(n.trim()));
  const frame = w && h ? w / h : 4 / 3;

  const measure = useCallback(
    (img: HTMLImageElement) => {
      if (!img.naturalWidth) {
        setFailed(true);
        return;
      }
      const shape = img.naturalWidth / img.naturalHeight;
      // Much taller than the frame: almost certainly a poster with text on it.
      setFit(shape < frame * 0.72 ? "contain" : "cover");
    },
    [frame],
  );

  // Images can finish loading before hydration, when onLoad has no handler
  // yet; the callback ref catches those.
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete) queueMicrotask(() => measure(img));
    },
    [measure],
  );

  const hue = getCategoryColor(category);

  return (
    <div
      className={`eimg ${className}`}
      style={{ aspectRatio: ratio, "--cat-hue": hue.color, "--cat-wash": hue.wash } as React.CSSProperties}
    >
      {failed ? (
        <div className="eimg-fallback" role={alt ? "img" : undefined} aria-label={alt || undefined}>
          <CategoryIcon category={category} size={40} />
        </div>
      ) : (
        <>
          {fit === "contain" && <img className="eimg-backdrop" src={(useOriginal ? src : sized(src, 48))!} alt="" aria-hidden="true" />}
          <img
            ref={ref}
            className={`eimg-img is-${fit}`}
            src={url!}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={(e) => measure(e.currentTarget)}
            onError={() => (url !== src ? setUseOriginal(true) : setFailed(true))}
          />
        </>
      )}
    </div>
  );
}
