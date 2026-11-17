import { describe, expect, it } from "vitest";
import { normalizeSpoken } from "./voice";

describe("normalizeSpoken", () => {
  it("maps Hinglish time words", () => {
    expect(normalizeSpoken("kal shaam comedy")).toBe("tomorrow evening comedy");
    expect(normalizeSpoken("aaj raat live music")).toBe("tonight live music");
    expect(normalizeSpoken("is weekend free mein kya hai")).toBe("this weekend free kya hai");
    expect(normalizeSpoken("standup paas mein")).toBe("standup near me");
  });
  it("leaves English alone", () => {
    expect(normalizeSpoken("  AI meetups this weekend ")).toBe("AI meetups this weekend");
  });
});
