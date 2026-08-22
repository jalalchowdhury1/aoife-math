// POST one finished round → Telegram summary to the parent. Unauthenticated on purpose:
// it accepts only a size-capped, type-checked RoundLog and can read nothing back.
import { NextResponse } from "next/server";
import { formatRoundSummary } from "@/lib/roundSummary";
import { sendTelegram } from "@/lib/telegram";
import type { RoundLog, RoundQuestionLog } from "@/lib/types";

const MAX_BODY = 50_000;
const MAX_QUESTIONS = 40;

const isQuestion = (x: unknown): x is RoundQuestionLog => {
  const q = x as RoundQuestionLog;
  return (
    !!q &&
    typeof q.id === "string" &&
    q.id.length <= 20 &&
    /^[0-9+\-×÷]+$/.test(q.id) &&
    typeof q.ms === "number" &&
    typeof q.correct === "boolean" &&
    (q.tries === undefined || typeof q.tries === "number")
  );
};

const isLog = (x: unknown): x is RoundLog => {
  const l = x as RoundLog;
  return (
    !!l &&
    typeof l.totalMs === "number" &&
    typeof l.score === "number" &&
    Array.isArray(l.perQuestion) &&
    l.perQuestion.length <= MAX_QUESTIONS &&
    l.perQuestion.every(isQuestion)
  );
};

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "too-large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!isLog(body)) return NextResponse.json({ error: "bad-round" }, { status: 400 });

  const notified = await sendTelegram(formatRoundSummary(body));
  return NextResponse.json({ ok: true, notified });
}
