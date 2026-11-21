"use client";

import { useCallback, useState } from "react";
import type { EventCategory } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import CategoryIcon from "./CategoryIcon";
import { blurred, sized } from "@/lib/imageUrl";

/**
 * The one image component every event picture goes through.
 *
 * - A fixed aspect-ratio frame with overflow hidden, so nothing stretches or
 *   spills, whatever size the source is.
 * - The picture is always shown whole, never cropped (object-fit: contain):
 *   event posters carry the title, date and line-up in their corners, and
 *   sources send them in every shape. Any space the shape leaves is filled
 *   by a blurred copy of the same picture, not bars.
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
  const measure = useCallback((img: HTMLImageElement) => {
    if (!img.naturalWidth) setFailed(true);
  }, []);

  // Images can finish loading before hydration, when onLoad has no handler
  // yet; the callback ref catches those.
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete) queueMicrotask(() => measure(img));
    },
    [measure],
  );

  const hue = getCategoryColor(category);
  // Pre-blurred by the resizer; only without one does CSS blur it.
  const fill = useOriginal ? null : blurred(src);

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
          {fill ? (
            <img className="eimg-backdrop" src={fill} alt="" aria-hidden="true" loading={priority ? "eager" : "lazy"} decoding="async" />
          ) : (
            <img className="eimg-backdrop is-css-blur" src={src!} alt="" aria-hidden="true" loading={priority ? "eager" : "lazy"} decoding="async" />
          )}
          <img
            ref={ref}
            className="eimg-img is-contain"
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
