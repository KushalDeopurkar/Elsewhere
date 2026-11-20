import { describe, expect, it } from "vitest";
import { matchesIntentWhen, parseIntent, scoreEvent, widenIntent, widenable } from "./intent";
import type { Event } from "./types";

// Friday 20 November 2026, 12:00 in Mumbai.
const NOW = Date.parse("2026-11-20T06:30:00Z");
const read = (q: string, zone = "Asia/Kolkata") => parseIntent(q, { now: NOW, zone });

let n = 0;
const ev = (over: Partial<Event>): Event =>
  ({
    id: String(++n),
    title: "Untitled",
    description: null,
    category: "other",
    start_time: "2026-11-22T14:00:00Z",
    end_time: null,
    location_name: "Somewhere",
    address: null,
    city: "Mumbai",
    country: "IN",
    lat: 19.07,
    lng: 72.87,
    image_url: null,
    url: null,
    price_min: 499,
    price_max: null,
    is_free: false,
    source: "test",
    ...over,
  }) as Event;

describe("places and days", () => {
  it("reads a world city and a single day, in that city's calendar", () => {
    const i = read("paris on saturday", "Europe/Paris");
    expect(i.city).toBe("Paris");
    expect(i.range).toMatchObject({ from: "2026-11-21", to: "2026-11-21" });
    expect(i.terms).toEqual([]);
    expect(i.signals.map((s) => s.label)).toEqual(expect.arrayContaining(["Paris", "Tomorrow"]));
  });

  it("keeps 'online' as a format", () => {
    expect(read("online ml talks").format).toBe("online");
  });

  it("'saturday' excludes Sunday in the event's own time", () => {
    const intent = read("paris on saturday", "Europe/Paris");
    const at = (iso: string) => ev({ start_time: iso, country: "FR", lat: 48.85, lng: 2.35, city: "Paris" });
    expect(matchesIntentWhen(at("2026-11-21T11:45:00Z"), intent)).toBe(true); // Sat 12:45 Paris
    expect(matchesIntentWhen(at("2026-11-22T08:00:00Z"), intent)).toBe(false); // Sun 9:00 Paris
    expect(matchesIntentWhen(at("2026-11-22T08:00:00Z"), read("paris this weekend", "Europe/Paris"))).toBe(true);
  });

  it("reads 'events on 22nd' as that day, with nothing else to find", () => {
    const i = read("events on 22nd");
    expect(i.range).toMatchObject({ from: "2026-11-22", to: "2026-11-22" });
    expect(i.terms).toEqual([]);
    expect(scoreEvent(ev({ start_time: "2026-11-22T14:00:00Z" }), i)?.exact).toBe(true);
    expect(scoreEvent(ev({ start_time: "2026-11-23T14:00:00Z" }), i)).toBeNull();
  });
});

describe("exact words", () => {
  const circus = ev({ title: "Olympian Dome Circus", category: "arts" });
  const gallery = ev({ title: "Modern Art Gallery Night", category: "arts" });
  const standup = ev({ title: "DROP OUT - Stand Up Comedy Show", category: "arts" });
  const workshop = ev({ title: "Pottery Workshop for beginners", category: "education" });
  const atelier = ev({ title: "Atelier d'écriture", category: "education", city: "Paris", country: "FR" });

  it("finds an event by its own name, first", () => {
    const i = read("olympian dome circus");
    expect(i.terms).toEqual(["olympian", "dome", "circus"]);
    expect(scoreEvent(circus, i)?.exact).toBe(true);
    expect(scoreEvent(gallery, i)).toBeNull();
  });

  it("a specific word must be found; its category alone is only related", () => {
    const i = read("comedy");
    expect(i.terms).toEqual(["comedy"]);
    expect(i.strict).toEqual([]);
    expect(scoreEvent(standup, i)?.exact).toBe(true);
    const g = scoreEvent(gallery, i);
    expect(g?.exact).toBe(false); // same category, offered as related
  });

  it("a broad category word filters instead", () => {
    const i = read("arts this weekend");
    expect(i.strict).toEqual(["arts"]);
    expect(i.terms).toEqual([]);
    expect(scoreEvent(gallery, i)?.exact).toBe(true);
    expect(scoreEvent(workshop, i)).toBeNull();
  });

  it("forgives plurals, typos and other languages' words", () => {
    expect(scoreEvent(workshop, read("workshops"))?.exact).toBe(true);
    expect(scoreEvent(workshop, read("potery"))?.exact).toBe(true);
    expect(scoreEvent(atelier, read("workshop"))?.exact).toBe(true);
  });

  it("quoted words must appear together", () => {
    const i = read('"stand up"');
    expect(i.phrases).toEqual(["stand up"]);
    expect(scoreEvent(standup, i)?.exact).toBe(true);
    expect(scoreEvent(circus, i)?.exact ?? false).toBe(false);
  });

  it("keeps known phrases whole", () => {
    const i = read("stand up comedy this weekend");
    expect(i.terms).toEqual(["standup comedy"]);
    expect(scoreEvent(ev({ title: "DROP OUT - Stand Up Comedy Show", category: "arts", start_time: "2026-11-21T14:00:00Z" }), i)?.exact).toBe(true);
    expect(scoreEvent(ev({ title: "Controversial Comedy", category: "arts", start_time: "2026-11-21T14:00:00Z" }), i)?.exact).toBe(true);
  });

  it("concerts count by category when the listing doesn't say the word", () => {
    expect(scoreEvent(ev({ title: "Arijit Singh Live", category: "music" }), read("concerts"))?.exact).toBe(true);
  });
});

describe("prices and times", () => {
  it("under a price, free, cheap", () => {
    expect(scoreEvent(ev({ title: "Jazz night", price_min: 400 }), read("jazz under 500"))?.exact).toBe(true);
    expect(scoreEvent(ev({ title: "Jazz night", price_min: 800 }), read("jazz under 500"))).toBeNull();
    expect(scoreEvent(ev({ title: "Jazz night", is_free: true, price_min: null }), read("free jazz"))?.exact).toBe(true);
    expect(read("cheap gigs", "Asia/Kolkata").cap?.max).toBe(500);
  });
  it("after 7pm", () => {
    const i = read("comedy after 7pm");
    expect(i.terms).toEqual(["comedy"]);
    expect(scoreEvent(ev({ title: "Comedy hour", start_time: "2026-11-22T14:00:00Z" }), i)?.exact).toBe(true); // 19:30
    expect(scoreEvent(ev({ title: "Comedy hour", start_time: "2026-11-22T08:00:00Z" }), i)).toBeNull(); // 13:30
  });
});

describe("widenIntent", () => {
  it("lets go of the date, the money ask, the topic or some words, and the chips follow", () => {
    const asked = read("free AI workshops this weekend");
    expect(widenable(asked)).toEqual(expect.arrayContaining(["when", "free", "topic", "words"]));
    const anyDate = widenIntent(asked, ["when"]);
    expect(anyDate.range).toBeNull();
    expect(anyDate.signals.some((s) => s.kind === "when")).toBe(false);
    expect(anyDate.freeOnly).toBe(true);
    const paid = widenIntent(asked, ["free"]);
    expect(paid.freeOnly).toBe(false);
    expect(paid.signals.some((s) => s.kind === "budget")).toBe(false);
    const anyTopic = widenIntent(asked, ["topic"]);
    expect(anyTopic.interests).toEqual([]);
  });
  it("changes nothing when nothing is widened", () => {
    const asked = read("music tonight");
    expect(widenIntent(asked, [])).toBe(asked);
  });
});

describe("plurals", () => {
  it("reads plural words as their interest", () => {
    const w = read("free AI workshops this weekend");
    expect(w.interests).toContain("education");
    expect(w.interests).toContain("tech");
    expect(read("I want to meet startup founders").interests).toContain("business");
    expect(read("hackathons near me").interests).toContain("tech");
    expect(read("football matches").interests).toContain("sports");
  });
  it("doesn't read a longer word as the shorter one", () => {
    expect(read("workshopping my script").interests).not.toContain("education");
  });
});
