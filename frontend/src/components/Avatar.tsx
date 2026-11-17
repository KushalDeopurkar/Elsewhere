"use client";

import { useState } from "react";

/** Round avatar with an initials fallback (no grey blobs). */
export default function Avatar({ src, name, size = 36, className = "" }: { src?: string | null; name: string; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  // A stable hue per name so initials avatars differ from one another.
  let x = 2166136261;
  for (const c of name) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
  const h = ((x >>> 0) % 12) * 30;
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size, "--av-hue": h } as React.CSSProperties} aria-hidden="true">
      {src && !broken ? (
        <img src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <span style={{ fontSize: Math.round(size * 0.4) }}>{initials}</span>
      )}
    </span>
  );
}
