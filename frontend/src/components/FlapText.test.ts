import { describe, expect, it } from "vitest";
import { flapPool } from "./FlapText";

describe("flapPool", () => {
  it("riffles digits through digits and letters through letters", () => {
    expect(flapPool("7")).toBe("0123456789");
    expect(flapPool("Q")).toMatch(/^[A-Z]+$/);
  });
  it("never moves a separator or a blank", () => {
    expect(flapPool(":")).toBe("");
    expect(flapPool(" ")).toBe("");
    expect(flapPool("₹")).toBe("");
  });
});
