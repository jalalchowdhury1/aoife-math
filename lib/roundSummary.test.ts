import { describe, it, expect } from "vitest";
import { formatRoundSummary } from "./roundSummary";

const q = (id: string, ms: number, correct: boolean, tries = 1) => ({ id, ms, correct, tries });

describe("formatRoundSummary", () => {
  it("formats a full round with misses, second tries and the slowest question", () => {
    const text = formatRoundSummary({
      date: "2026-08-22T10:00:00Z",
      totalMs: 252_000,
      score: 18,
      perQuestion: [
        q("4821+6130", 58_000, true), q("1000+2000", 5000, true), q("1111+2222", 5000, true), q("1234+5678", 5000, true), q("2000+3000", 5000, true),
        q("67-29", 9000, false), q("50-25", 4000, true, 2), q("10-3", 3000, true), q("90-45", 3000, true), q("80-1", 2000, true),
        q("23×4", 7000, true), q("12×9", 7000, true, 2), q("45×2", 6000, true), q("99×9", 9000, true), q("10×2", 2000, true),
        q("84÷7", 12_000, false), q("36÷6", 3000, true, 2), q("144÷12", 5000, true), q("18÷2", 2000, true), q("27÷3", 2000, true),
      ],
    });
    expect(text).toBe(
      [
        "🔢 Aoife Math — round done (4 min 12 s) · 18/20",
        "+ 5/5   − 4/5   × 5/5   ÷ 4/5",
        "Missed: 67 − 29, 84 ÷ 7",
        "Needed 2 tries: 3",
        "Slowest: 4821 + 6130 (58 s)",
      ].join("\n"),
    );
  });

  it("omits empty lines and tolerates logs without a tries field", () => {
    const text = formatRoundSummary({
      date: "x",
      totalMs: 61_000,
      score: 2,
      perQuestion: [
        { id: "1+1", ms: 1000, correct: true },
        { id: "2÷1", ms: 2000, correct: true },
      ],
    });
    expect(text).toBe(
      ["🔢 Aoife Math — round done (1 min 1 s) · 2/20", "+ 1/1   − 0/0   × 0/0   ÷ 1/1", "Slowest: 2 ÷ 1 (2 s)"].join("\n"),
    );
  });

  it("no timings → no slowest line", () => {
    expect(formatRoundSummary({ date: "x", totalMs: 0, score: 0, perQuestion: [] })).toBe(
      "🔢 Aoife Math — round done (0 s) · 0/20\n+ 0/0   − 0/0   × 0/0   ÷ 0/0",
    );
  });

  it("a second-try miss (revealed) counts as missed, not as a second try", () => {
    const text = formatRoundSummary({ date: "x", totalMs: 5000, score: 0, perQuestion: [q("9-4", 5000, false, 2)] });
    expect(text).toContain("Missed: 9 − 4");
    expect(text).not.toContain("Needed 2 tries");
  });
});
