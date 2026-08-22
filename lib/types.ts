// Round log shape — shared by the game (app/page.tsx), the parent peek overlay and the
// /api/rounds Telegram route. Saved to localStorage["aoife-math-times"].

export interface RoundQuestionLog {
  id: string; // e.g. "4821+6130", "67-29", "23×4", "84÷7"
  ms: number;
  correct: boolean;
  /** 1 = right first time, 2 = right on the second try (or revealed). Absent in pre-2026-08-22 logs. */
  tries?: number;
}

export interface RoundLog {
  date: string; // ISO timestamp
  totalMs: number;
  score: number;
  perQuestion: RoundQuestionLog[];
}
