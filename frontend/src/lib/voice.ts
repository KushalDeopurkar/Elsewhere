/**
 * Spoken searches often come out in Hinglish ("kal shaam comedy"). The
 * search understands English time words, so map the common Hindi ones
 * before searching. Word-boundary replacements only; everything else is
 * passed through untouched.
 */
const PHRASES: [RegExp, string][] = [
  [/\bis (weekend|hafte)\b/gi, "this weekend"],
  [/\b(aaj|aj) raat\b/gi, "tonight"],
  [/\b(aaj|aj) shaam\b/gi, "this evening"],
  [/\bkal shaam\b/gi, "tomorrow evening"],
  [/\bkal raat\b/gi, "tomorrow night"],
  [/\bkal subah\b/gi, "tomorrow morning"],
  [/\bfree mein\b/gi, "free"],
  [/\bmere paas\b|\bpaas mein\b|\bnazdeek\b/gi, "near me"],
];
const WORDS: Record<string, string> = {
  aaj: "today",
  aj: "today",
  kal: "tomorrow",
  parso: "day after tomorrow",
  shaam: "evening",
  raat: "night",
  subah: "morning",
  sasta: "cheap",
  muft: "free",
  gaana: "music",
  gaane: "music",
  khana: "food",
  khaana: "food",
};

export function normalizeSpoken(text: string): string {
  let out = text.trim();
  for (const [re, to] of PHRASES) out = out.replace(re, to);
  out = out.replace(/\b[a-z]+\b/gi, (w) => WORDS[w.toLowerCase()] ?? w);
  return out.replace(/\s+/g, " ").trim();
}
