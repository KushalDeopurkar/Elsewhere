/**
 * Turn a poster's dominant colour into a small, readable palette for the
 * event page: a soft glow, a faint wash, and an accent lightened until it
 * clears 4.5:1 against the page background. Pure, so it is unit-tested.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}
export interface Tint {
  glow: string;
  wash: string;
  accent: string;
}

const PAGE_BG: RGB = { r: 14, g: 16, b: 21 }; // --ink-900

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance({ r, g, b }: RGB): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrast(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export function toHsl({ r, g, b }: RGB): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h /= 6;
  return [h, s, l];
}

export function fromHsl(h: number, s: number, l: number): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: Math.round(f(h + 1 / 3) * 255), g: Math.round(f(h) * 255), b: Math.round(f(h - 1 / 3) * 255) };
}

const hex = ({ r, g, b }: RGB) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const rgba = ({ r, g, b }: RGB, a: number) => `rgb(${r} ${g} ${b} / ${a})`;

/** Null when the poster is too grey to say anything; callers fall back. */
export function tintPalette(dominant: RGB): Tint | null {
  const [h, s] = toHsl(dominant);
  if (s < 0.14) return null;
  const sat = Math.min(0.85, Math.max(0.5, s));
  const glow = fromHsl(h, sat, 0.52);
  let l = 0.6;
  let accent = fromHsl(h, sat, l);
  while (contrast(accent, PAGE_BG) < 4.5 && l < 0.92) {
    l += 0.02;
    accent = fromHsl(h, sat, l);
  }
  return { glow: rgba(glow, 0.3), wash: rgba(glow, 0.1), accent: hex(accent) };
}
