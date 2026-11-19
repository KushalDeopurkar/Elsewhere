import { describe, expect, it } from "vitest";
import { reminderFor, remindersFor, MAX_REMINDERS } from "./reminders";
import { cleanReminders, parseSub, PushInputError } from "./pushServer";
import { Event } from "./types";

const ev = (over: Partial<Event>): Event =>
  ({
    id: "e1",
    title: "Jazz night",
    description: null,
    category: "music",
    start_time: "2026-11-20T14:00:00Z", // 7:30 pm IST
    end_time: null,
    location_name: "Blue Frog",
    address: null,
    city: "Mumbai",
    country: "IN",
    lat: 19.0,
    lng: 72.8,
    image_url: null,
    url: null,
    price_min: null,
    price_max: null,
    is_free: false,
    source: "x",
    distance_km: null,
    relevance: null,
    ...over,
  }) as Event;

const NOW = Date.parse("2026-11-19T10:00:00Z");

describe("reminderFor", () => {
  it("fires 2 hours before a timed event, in the event's local time", () => {
    const r = reminderFor(ev({}), NOW)!;
    expect(r.remind_at).toBe("2026-11-20T12:00:00.000Z");
    expect(r.title).toBe("In 2 hours: Jazz night");
    expect(r.body).toBe("Blue Frog · starts 7:30 pm");
    expect(r.url).toBe("/events/e1");
  });

  it("uses the venue's own zone abroad", () => {
    const r = reminderFor(ev({ start_time: "2026-11-21T00:00:00Z", country: "US", lat: 40.7, lng: -74 }), NOW)!;
    expect(r.body).toMatch(/starts 7:00 pm/);
  });

  it("nudges at 9 am local on the day for date-only events", () => {
    // Midnight IST = date only.
    const r = reminderFor(ev({ start_time: "2026-11-20T18:30:00Z" }), NOW)!;
    expect(r.remind_at).toBe("2026-11-21T03:30:00.000Z");
    expect(r.title).toBe("Today: Jazz night");
    expect(r.body).toBe("Blue Frog");
  });

  it("skips reminders whose moment has passed or are too far out", () => {
    expect(reminderFor(ev({ start_time: "2026-11-19T11:00:00Z" }), NOW)).toBeNull();
    expect(reminderFor(ev({ start_time: "2027-06-01T14:00:00Z" }), NOW)).toBeNull();
    expect(reminderFor(ev({ start_time: "nope" }), NOW)).toBeNull();
  });

  it("sorts soonest first and caps the list", () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      ev({ id: `e${i}`, start_time: new Date(NOW + (80 - i) * 3_600_000 + 3 * 3_600_000).toISOString() }),
    );
    const list = remindersFor(many, NOW);
    expect(list).toHaveLength(MAX_REMINDERS);
    expect(list[0].event_id).toBe("e79");
  });
});

describe("server checks", () => {
  const keys = { p256dh: "B".repeat(87), auth: "a".repeat(22) };

  it("accepts real push services only", () => {
    expect(parseSub({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys }).endpoint).toContain("fcm");
    expect(parseSub({ endpoint: "https://web.push.apple.com/QG", keys }).endpoint).toContain("apple");
    expect(() => parseSub({ endpoint: "https://evil.example/x", keys })).toThrow(PushInputError);
    expect(() => parseSub({ endpoint: "http://fcm.googleapis.com/x", keys })).toThrow(PushInputError);
    expect(() => parseSub({ endpoint: "https://fcm.googleapis.com.evil.io/x", keys })).toThrow(PushInputError);
    expect(() => parseSub({ endpoint: "https://fcm.googleapis.com/x", keys: { ...keys, auth: "x y" } })).toThrow();
  });

  it("drops malformed, duplicate, off-site and out-of-range reminders", () => {
    const at = new Date(NOW + 3_600_000).toISOString();
    const out = cleanReminders(
      [
        { event_id: "a", remind_at: at, title: "A", body: "b", url: "/events/a" },
        { event_id: "a", remind_at: at, title: "A again", url: "/events/a" },
        { event_id: "b", remind_at: at, title: "B", url: "https://evil.example" },
        { event_id: "c", remind_at: at, title: "C", url: "//evil.example" },
        { event_id: "d", remind_at: "2030-01-01T00:00:00Z", title: "D", url: "/x" },
        { event_id: "e", remind_at: at, title: "", url: "/x" },
        { event_id: "f", remind_at: at, title: "F".repeat(500), url: "/events/f" },
      ],
      NOW,
    );
    expect(out.map((r) => r.event_id)).toEqual(["a", "f"]);
    expect(out[1].title).toHaveLength(120);
    expect(() => cleanReminders("nope", NOW)).toThrow(PushInputError);
  });
});
