import { describe, expect, it } from "vitest";
import { parseBudget } from "./plan";

describe("planner budgets in any currency", () => {
  it("reads rupees as before", () => {
    expect(parseBudget("Saturday under ₹1000, music")).toBe(1000);
    expect(parseBudget("budget 800 rs")).toBe(800);
  });
  it("reads dollars, pounds and euros", () => {
    expect(parseBudget("Saturday in London under £40")).toBe(40);
    expect(parseBudget("free or cheap, max $25 in NYC")).toBe(25);
    expect(parseBudget("dinner and a show, 60 euros")).toBe(60);
    expect(parseBudget("30 quid night out")).toBe(30);
  });
  it("finds none when none is stated", () => {
    expect(parseBudget("Tomorrow evening in Paris: comedy, then dinner")).toBeNull();
  });
});
