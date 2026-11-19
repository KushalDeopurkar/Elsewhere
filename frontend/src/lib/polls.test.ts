import { describe, expect, it } from "vitest";
import { leader, tally } from "./polls";

const v = (event_id: string, name = "x") => ({ name, avatar_url: null, username: null, event_id });

describe("poll tally", () => {
  it("counts votes per option in the poll's order and marks the leader", () => {
    const poll = { event_ids: ["a", "b", "c"], votes: [v("b"), v("a"), v("b")] };
    const t = tally(poll);
    expect(t.map((r) => r.votes.length)).toEqual([1, 2, 0]);
    expect(t.map((r) => r.leading)).toEqual([false, true, false]);
    expect(t[1].share).toBeCloseTo(2 / 3);
    expect(leader(poll)).toBe("b");
  });

  it("has no single leader on a tie or with no votes", () => {
    expect(leader({ event_ids: ["a", "b"], votes: [v("a"), v("b")] })).toBeNull();
    expect(tally({ event_ids: ["a", "b"], votes: [] }).every((r) => !r.leading && r.share === 0)).toBe(true);
  });
});
