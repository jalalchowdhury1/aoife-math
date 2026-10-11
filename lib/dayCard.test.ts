import { describe, it, expect } from "vitest";
import { etDay, toDayCard, type DayCardDeps } from "./dayCard";

const deps = (over: Partial<DayCardDeps> = {}) => {
  const stashed: [string, string, string][] = [];
  const sent: string[] = [];
  const d: DayCardDeps = {
    ready: () => true,
    stash: async (day, field, value) => void stashed.push([day, field, value]),
    send: async (t) => (sent.push(t), true),
    ...over,
  };
  return { d, stashed, sent };
};

describe("day card", () => {
  it("etDay uses Eastern time", () => {
    expect(etDay("2026-10-12T03:30:00.000Z")).toBe("2026-10-11"); // 11:30 PM ET
    expect(etDay("2026-10-12T04:30:00.000Z")).toBe("2026-10-12");
  });

  it("stashes the summary for the card instead of sending", async () => {
    const { d, stashed, sent } = deps();
    expect(await toDayCard("2026-10-11T18:00:00.000Z", "<b>20/20</b>", d)).toBe(true);
    expect(sent).toEqual([]);
    expect(stashed).toEqual([[
      "2026-10-11", "math:2026-10-11T18:00:00.000Z",
      JSON.stringify({ app: "math", at: "2026-10-11T18:00:00.000Z", text: "<b>20/20</b>" }),
    ]]);
  });

  it("a failed stash returns false so the client retries", async () => {
    const { d } = deps({ stash: async () => { throw new Error("down"); } });
    expect(await toDayCard("2026-10-11T18:00:00.000Z", "x", d)).toBe(false);
  });

  it("no KV configured → the old direct ping", async () => {
    const { d, sent, stashed } = deps({ ready: () => false });
    expect(await toDayCard("2026-10-11T18:00:00.000Z", "x", d)).toBe(true);
    expect(sent).toEqual(["x"]);
    expect(stashed).toEqual([]);
  });
});
