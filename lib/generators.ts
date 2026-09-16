// Question generators for a round — extracted from app/page.tsx so they can be
// unit tested (repo convention: Vitest, lib/**/*.test.ts only). Pure functions,
// no behavior change from the inline versions they replace.

export type Op = "+" | "-" | "×" | "÷";

export interface Question {
  num1: number;
  num2: number;
  op: Op;
  answer: number;
  id: string;
}

export const QUESTIONS_PER_OP = 5;

// 4-digit + 4-digit, sum ≤ 13,000 (same as the old aoife-math-game)
export const genAddition = (): Question => {
  const num1 = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
  const maxNum2 = Math.min(9999, 13000 - num1);
  const num2 = Math.floor(Math.random() * (maxNum2 - 1000 + 1)) + 1000;
  return { num1, num2, op: "+", answer: num1 + num2, id: `${num1}+${num2}` };
};

// num1 1-100, num2 1-num1 (same as long-subtraction-aoife)
export const genSubtraction = (): Question => {
  const num1 = Math.floor(Math.random() * 100) + 1; // 1-100
  const num2 = Math.floor(Math.random() * num1) + 1; // 1-num1
  return { num1, num2, op: "-", answer: num1 - num2, id: `${num1}-${num2}` };
};

// double-digit × single-digit: 10-99 × 2-9
export const genMultiplication = (): Question => {
  const num1 = Math.floor(Math.random() * 90) + 10; // 10-99
  const num2 = Math.floor(Math.random() * 8) + 2; // 2-9
  return { num1, num2, op: "×", answer: num1 * num2, id: `${num1}×${num2}` };
};

// inverse times-table facts: (divisor × quotient) ÷ divisor, both 2-12
export const genDivision = (): Question => {
  const divisor = Math.floor(Math.random() * 11) + 2; // 2-12
  const quotient = Math.floor(Math.random() * 11) + 2; // 2-12
  const dividend = divisor * quotient;
  return { num1: dividend, num2: divisor, op: "÷", answer: quotient, id: `${dividend}÷${divisor}` };
};

export const GENERATORS = [genAddition, genSubtraction, genMultiplication, genDivision];

// 5 unique questions per operation, then everything shuffled together
export const buildRound = (): Question[] => {
  const round: Question[] = [];
  const usedIds = new Set<string>();
  for (const gen of GENERATORS) {
    let added = 0;
    while (added < QUESTIONS_PER_OP) {
      const q = gen();
      if (!usedIds.has(q.id)) {
        round.push(q);
        usedIds.add(q.id);
        added++;
      }
    }
  }
  // Fisher–Yates shuffle across all 20
  for (let i = round.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [round[i], round[j]] = [round[j], round[i]];
  }
  return round;
};
