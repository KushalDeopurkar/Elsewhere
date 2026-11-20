import { describe, expect, it } from "vitest";
import { correctQuery } from "./spell";
import { editDistance, fuzzyHas, isTypoOf, wordsOf } from "./fuzzy";
import { detectCity } from "./cities";
import { parseIntent } from "./intent";

const fixed = (q: string, seen: string[] = []) => correctQuery(q, seen).text;

describe("fuzzy words", () => {
  it("counts a swap of neighbouring letters as one edit", () => {
    expect(editDistance("mumbia", "mumbai")).toBe(1);
    expect(editDistance("pars", "paris")).toBe(1);
    expect(editDistance("abc", "xyz", 1)).toBe(2);
  });
  it("needs the first letter right, so june is not pune", () => {
    expect(isTypoOf("pars", "paris")).toBe(true);
    expect(isTypoOf("june", "pune")).toBe(false);
    expect(isTypoOf("tune", "pune")).toBe(false);
  });
  it("finds a typed word in text exactly, as a word start, or with a typo", () => {
    const w = wordsOf("Mumbai Hackathon: build with AI");
    expect(fuzzyHas(w, "hack")).toBe(true);
    expect(fuzzyHas(w, "hackthon")).toBe(true);
    expect(fuzzyHas(w, "cooking")).toBe(false);
  });
});

describe("spelling correction", () => {
  it("par and pars both mean Paris", () => {
    expect(fixed("pars")).toBe("paris");
    expect(fixed("par")).toBe("paris");
    expect(fixed("gigs in pars this weekend")).toBe("gigs in paris this weekend");
    expect(detectCity(fixed("events in par"))?.city.name).toBe("Paris");
  });
  it("fixes other city typos", () => {
    expect(fixed("mumbia")).toBe("mumbai");
    expect(fixed("banglore")).toBe("bangalore");
    expect(fixed("dehli")).toBe("delhi");
    expect(fixed("lodnon")).toBe("london");
    expect(fixed("new yrok")).toBe("new york");
  });
  it("fixes the reader's own words, so the request is understood", () => {
    expect(fixed("workshp")).toBe("workshop");
    expect(fixed("comdey in mumbia")).toBe("comedy in mumbai");
    expect(parseIntent(fixed("comdey")).interests).toContain("arts");
    expect(fixed("hackthon this weekend")).toBe("hackathon this weekend");
    expect(parseIntent(fixed("yoga tomorow")).when).toBe("tomorrow");
  });
  it("learns words from the events on show", () => {
    expect(fixed("comdey", ["comedy", "standup"])).toBe("comedy");
    expect(fixed("standup", ["standup"])).toBe("standup");
  });
  it("leaves real words and short words alone", () => {
    for (const q of ["music in june", "free events tonight", "art", "tech meetup", "run", "jazz", "ai", "sea", "pub quiz", "salsa night"]) {
      expect(correctQuery(q).fixes).toEqual([]);
    }
  });
  it("reports each change, keeping the rest of the text as typed", () => {
    const s = correctQuery("Comedy in Mumbia!");
    expect(s.fixes).toEqual([{ from: "Mumbia", to: "mumbai" }]);
    expect(s.text).toBe("Comedy in mumbai!");
  });
});
