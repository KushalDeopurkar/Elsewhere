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

/** Static instances of Archivo (OFL) cut for satori, which can't read variable fonts. */
export const OG_FONTS = {
  black: new URL("../app/api/card/fonts/Archivo-CondensedBlack.ttf", import.meta.url),
  bold: new URL("../app/api/card/fonts/Archivo-SemiCondensedBold.ttf", import.meta.url),
  text: new URL("../app/api/card/fonts/Geist-Regular.ttf", import.meta.url),
};
