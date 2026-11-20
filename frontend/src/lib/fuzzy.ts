/**
 * Forgiving word matching for search: small typos ("pars", "mumbia",
 * "workshp") and unfinished words ("par") still find what was meant.
 * Pure and dependency-free, so it runs on every keystroke and in tests.
 */

/**
 * Edit distance counting a swap of two neighbouring letters as one edit
 * (optimal string alignment). Stops early and returns max + 1 once the
 * distance must exceed `max`.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = b.length;
  let prev2 = new Array<number>(n + 1).fill(0);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(n + 1);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

/** How many typos a word of this length may carry: none under 4 letters, one up to 5, two beyond. */
export function typoLimit(length: number): number {
  return length < 4 ? 0 : length <= 5 ? 1 : 2;
}

/**
 * Is `typed` a misspelling of `word`? Both lower case. People rarely get
 * the first letter wrong, and requiring it keeps "june" from becoming "pune".
 */
export function isTypoOf(typed: string, word: string): boolean {
  if (typed === word) return true;
  if (!typed || !word || typed[0] !== word[0]) return false;
  const limit = typoLimit(Math.min(typed.length, word.length));
  return limit > 0 && editDistance(typed, word, limit) <= limit;
}

/** Lower-case words of a text, letters and digits only. */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Does any word of the text match the typed word: exactly, as the start of
 * a longer word ("hack" in "hackathon", from 3 letters), or with a typo?
 */
export function fuzzyHas(textWords: string[], typed: string): boolean {
  for (const w of textWords) {
    if (w === typed) return true;
    if (typed.length >= 3 && w.startsWith(typed)) return true;
    if (isTypoOf(typed, w)) return true;
  }
  return false;
}
