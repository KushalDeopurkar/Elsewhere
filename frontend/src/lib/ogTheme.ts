/**
 * The design tokens as literal hex, for server-rendered images (Open Graph
 * cards, share cards), where CSS variables don't exist. Converted from the
 * OKLCH values in app/tokens.css; keep the two in step.
 */
export const OG = {
  paper: "#f8fafd",
  paper2: "#eff3f7",
  ink: "#0e192e",
  ink2: "#333d50",
  ink3: "#555e6f",
  signal: "#fcd726",
  board: "#0a152a",
  board2: "#15223b",
  boardFg: "#f3f0e7",
  boardFg2: "#a7b2c1",
  lamp: "#ffbd34",
} as const;

/** The split-flap E mark as an SVG data URI, for satori images (same paths as BrandMark.tsx). */
export function brandMark(fg: string = OG.boardFg, accent: string = OG.signal): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M43 4.5H12.5a8 8 0 0 0-8 8v39a8 8 0 0 0 8 8h39a8 8 0 0 0 8-8V21.5" fill="none" stroke="${fg}" stroke-width="3.4" stroke-linejoin="round"/><path d="M45.4 1.8h6.1a10.7 10.7 0 0 1 10.7 10.7v6.1l-5.4-5.4v-.7a5.3 5.3 0 0 0-5.3-5.3h-.7z" fill="${accent}"/><g fill="${fg}"><rect x="6.2" y="27" width="3.6" height="8" rx="1.6"/><rect x="54.2" y="27" width="3.6" height="8" rx="1.6"/><rect x="8" y="30.2" width="48" height="1.6"/><path d="M17 14h27v6.5H24.5V25H41v4.4H17z"/><path d="M17 32.6h24v1.8H24.5v8.1h20v7H17z"/></g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** Static instances of Archivo (OFL) cut for satori, which can't read variable fonts. */
export const OG_FONTS = {
  black: new URL("../app/api/card/fonts/Archivo-CondensedBlack.ttf", import.meta.url),
  bold: new URL("../app/api/card/fonts/Archivo-SemiCondensedBold.ttf", import.meta.url),
  text: new URL("../app/api/card/fonts/Geist-Regular.ttf", import.meta.url),
};
