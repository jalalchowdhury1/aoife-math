import { describe, it, expect } from "vitest";
import {
  genAddition,
  genSubtraction,
  genMultiplication,
  genDivision,
  buildRound,
  QUESTIONS_PER_OP,
} from "./generators";

const RUNS = 500; // generators use Math.random(); sample heavily to catch range bugs

describe("genAddition", () => {
  it("both operands are 4-digit and the sum never exceeds 13,000", () => {
    for (let i = 0; i < RUNS; i++) {
      const q = genAddition();
      expect(q.num1).toBeGreaterThanOrEqual(1000);
      expect(q.num1).toBeLessThanOrEqual(9999);
      expect(q.num2).toBeGreaterThanOrEqual(1000);
      expect(q.num2).toBeLessThanOrEqual(9999);
      expect(q.num1 + q.num2).toBeLessThanOrEqual(13000);
      expect(q.answer).toBe(q.num1 + q.num2);
      expect(q.op).toBe("+");
    }
  });
});

describe("genSubtraction", () => {
  it("num1 is 1-100, num2 is 1-num1, and the answer is never negative", () => {
    for (let i = 0; i < RUNS; i++) {
      const q = genSubtraction();
      expect(q.num1).toBeGreaterThanOrEqual(1);
      expect(q.num1).toBeLessThanOrEqual(100);
      expect(q.num2).toBeGreaterThanOrEqual(1);
      expect(q.num2).toBeLessThanOrEqual(q.num1);
      expect(q.answer).toBe(q.num1 - q.num2);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.op).toBe("-");
    }
  });
});

describe("genMultiplication", () => {
  it("is a double-digit times a single-digit (2-9)", () => {
    for (let i = 0; i < RUNS; i++) {
      const q = genMultiplication();
      expect(q.num1).toBeGreaterThanOrEqual(10);
      expect(q.num1).toBeLessThanOrEqual(99);
      expect(q.num2).toBeGreaterThanOrEqual(2);
      expect(q.num2).toBeLessThanOrEqual(9);
      expect(q.answer).toBe(q.num1 * q.num2);
      expect(q.op).toBe("×");
    }
  });
});

describe("genDivision", () => {
  it("is always an exact times-table fact (divisor and quotient 2-12)", () => {
    for (let i = 0; i < RUNS; i++) {
      const q = genDivision();
      // num1 = dividend, num2 = divisor, answer = quotient
      expect(q.num2).toBeGreaterThanOrEqual(2);
      expect(q.num2).toBeLessThanOrEqual(12);
      expect(q.answer).toBeGreaterThanOrEqual(2);
      expect(q.answer).toBeLessThanOrEqual(12);
      expect(q.num1).toBe(q.num2 * q.answer);
      expect(q.num1 % q.num2).toBe(0); // never a remainder
      expect(q.op).toBe("÷");
    }
  });
});

describe("buildRound", () => {
  it("returns exactly 20 questions: 5 of each operation", () => {
    const round = buildRound();
    expect(round.length).toBe(4 * QUESTIONS_PER_OP);
    const byOp = { "+": 0, "-": 0, "×": 0, "÷": 0 } as Record<string, number>;
    for (const q of round) byOp[q.op]++;
    expect(byOp["+"]).toBe(QUESTIONS_PER_OP);
    expect(byOp["-"]).toBe(QUESTIONS_PER_OP);
    expect(byOp["×"]).toBe(QUESTIONS_PER_OP);
    expect(byOp["÷"]).toBe(QUESTIONS_PER_OP);
  });

  it("never contains two questions with the same id (no duplicate she'd notice)", () => {
    for (let i = 0; i < 50; i++) {
      const round = buildRound();
      const ids = round.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("every question's stored answer matches its own operands (a stale answer would silently mark her wrong)", () => {
    const round = buildRound();
    for (const q of round) {
      switch (q.op) {
        case "+":
          expect(q.answer).toBe(q.num1 + q.num2);
          break;
        case "-":
          expect(q.answer).toBe(q.num1 - q.num2);
          break;
        case "×":
          expect(q.answer).toBe(q.num1 * q.num2);
          break;
        case "÷":
          expect(q.answer).toBe(q.num1 / q.num2);
          break;
      }
    }
  });
});
