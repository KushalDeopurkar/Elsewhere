import { describe, expect, it } from "vitest";
import { decodeEntities } from "./text";

describe("decodeEntities", () => {
  it("decodes common and double-encoded entities", () => {
    expect(decodeEntities("Finance &amp; Tech")).toBe("Finance & Tech");
    expect(decodeEntities("A &amp;amp; B")).toBe("A & B");
    expect(decodeEntities("Rock &#39;n&#39; Roll &quot;Live&quot; &#x27;x&#x27;")).toBe("Rock 'n' Roll \"Live\" 'x'");
    expect(decodeEntities("Fish & Chips")).toBe("Fish & Chips");
  });
});
