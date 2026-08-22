// Builds the parent's Telegram summary for one finished round. Pure; unit-tested.
// Runs on the server (app/api/rounds) — nothing here is ever shown to Aoife.
import type { RoundLog, RoundQuestionLog } from "./types";

const OPS = ["+", "-", "×", "÷"] as const;
type Op = (typeof OPS)[number];
const DISPLAY: Record<Op, string> = { "+": "+", "-": "−", "×": "×", "÷": "÷" };
const TOTAL_QUESTIONS = 20;

const opOf = (id: string): Op => OPS.find((o) => id.includes(o)) ?? "+";

const pretty = (id: string): string => {
  const op = opOf(id);
  const [a, b] = id.split(op);
  return `${a} ${DISPLAY[op]} ${b}`;
};

const clock = (ms: number): string => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
};

export function formatRoundSummary(log: RoundLog): string {
  const lines = [`🔢 Aoife Math — round done (${clock(log.totalMs)}) · ${log.score}/${TOTAL_QUESTIONS}`];

  lines.push(
    OPS.map((op) => {
      const qs = log.perQuestion.filter((q) => opOf(q.id) === op);
      return `${DISPLAY[op]} ${qs.filter((q) => q.correct).length}/${qs.length}`;
    }).join("   "),
  );

  const missed = log.perQuestion.filter((q) => !q.correct).map((q) => pretty(q.id));
  if (missed.length) lines.push(`Missed: ${missed.join(", ")}`);

  const retries = log.perQuestion.filter((q) => q.correct && (q.tries ?? 1) > 1).length;
  if (retries) lines.push(`Needed 2 tries: ${retries}`);

  const slowest = log.perQuestion.reduce<RoundQuestionLog | null>(
    (best, q) => (q.ms > 0 && (!best || q.ms > best.ms) ? q : best),
    null,
  );
  if (slowest) lines.push(`Slowest: ${pretty(slowest.id)} (${clock(slowest.ms)})`);

  return lines.join("\n");
}
