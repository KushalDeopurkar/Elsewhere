import { describe, expect, it } from "vitest";
import { matchesIntentWhen, parseIntent, widenIntent, widenable } from "./intent";
describe("places and days", () => {
  it("reads a world city and a single day", () => {
    const i = parseIntent("paris on saturday");
    expect(i.city).toBe("Paris");
    expect(i.when).toBe("weekend");
    expect(i.day).toBe("Sat");
    expect(i.signals.map((s) => s.label)).toEqual(expect.arrayContaining(["Paris", "Saturday"]));
  });

  it("keeps 'online' as before", () => {
    expect(parseIntent("online ml talks").city).toBe("Online");
  });

  it("'saturday' excludes Sunday in the event's own time", () => {
    const now = new Date("2026-11-19T10:00:00Z"); // Thursday
    const intent = parseIntent("paris on saturday");
    const at = (iso: string) => ({ start_time: iso, country: "FR", lat: 48.85, lng: 2.35, city: "Paris" }) as never;
    expect(matchesIntentWhen(at("2026-11-21T11:45:00Z"), intent, now)).toBe(true); // Sat 12:45 Paris
    expect(matchesIntentWhen(at("2026-11-22T08:00:00Z"), intent, now)).toBe(false); // Sun 9:00 Paris
    expect(matchesIntentWhen(at("2026-11-22T08:00:00Z"), parseIntent("paris this weekend"), now)).toBe(true);
  });
});

describe("widenIntent", () => {
  it("lets go of the date, the free-only ask or the topic, and the chips follow", () => {
    const asked = parseIntent("free AI workshops this weekend");
    expect(widenable(asked)).toEqual(["when", "free", "topic"]);
    const anyDate = widenIntent(asked, ["when"]);
    expect(anyDate.when).toBe("any");
    expect(anyDate.signals.some((s) => s.kind === "when")).toBe(false);
    expect(anyDate.freeOnly).toBe(true);
    const paid = widenIntent(asked, ["free"]);
    expect(paid.freeOnly).toBe(false);
    expect(paid.signals.some((s) => s.kind === "budget")).toBe(false);
    const anyTopic = widenIntent(asked, ["topic"]);
    expect(anyTopic.interests).toEqual([]);
  });
  it("changes nothing when nothing is widened", () => {
    const asked = parseIntent("music tonight");
    expect(widenIntent(asked, [])).toBe(asked);
  });
});
