import { describe, expect, it } from "vitest";
import { onlyAboutPlan } from "./planEngine";
import type { Event } from "./types";

const ev = (title: string, venue: string) => ({ id: title, title, location_name: venue, start_time: "2026-11-21T12:30:00Z" }) as Event;

describe("the planner's text only describes the plan on screen", () => {
  it("drops a sentence about a stop that didn't make it", () => {
    const stops = [{ event: ev("Comedy Hour", "The Habitat") }, { event: ev("Late Laughs", "Canvas Laugh Club") }];
    const pool = [...stops.map((s) => s.event), ev("Dinner at Westin", "Westin Powai")];
    const text = "Two comedy sets in Andheri. Dinner is at Westin Powai between them. Leave early for traffic.";
    expect(onlyAboutPlan(text, stops, pool)).toBe("Two comedy sets in Andheri. Leave early for traffic.");
  });
});
