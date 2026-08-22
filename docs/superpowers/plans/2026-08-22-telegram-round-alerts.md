# Telegram Round Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Aoife finishes a 20-question round, Jalal receives one Telegram summary in the @ZingerJC_bot DM — exactly like aoife-puzzles' part summaries.

**Architecture:** The client (`app/page.tsx`) keeps saving rounds to localStorage and additionally POSTs the round log to a new `app/api/rounds/route.ts`. The route validates the body, formats it with a pure `lib/roundSummary.ts`, and sends via `lib/telegram.ts` (copied from aoife-puzzles). No database.

**Tech Stack:** Next.js 16 App Router route handler, Vitest 3 (new), Telegram Bot API via fetch, Vercel env vars.

Spec: `docs/superpowers/specs/2026-08-22-telegram-round-alerts-design.md`

---

### Task 1: Vitest + pure round-summary formatter (TDD)

**Files:**
- Create: `vitest.config.ts`, `lib/roundSummary.ts`, `lib/roundSummary.test.ts`, `lib/types.ts`
- Modify: `package.json` (add `vitest` devDependency + `test` script)

- [ ] **Step 1: Install vitest** — `npm install --save-dev vitest@^3 --cache ./.npm-cache` (global npm cache is corrupted on this Mac; `.npm-cache/` is gitignored). Add `"test": "vitest run"` to scripts.

- [ ] **Step 2: `vitest.config.ts`**
```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
});
```

- [ ] **Step 3: `lib/types.ts`** — move the round-log types out of `page.tsx` so server and client share one definition:
```ts
export interface RoundQuestionLog { id: string; ms: number; correct: boolean; tries?: number }
export interface RoundLog { date: string; totalMs: number; score: number; perQuestion: RoundQuestionLog[] }
```

- [ ] **Step 4: failing test `lib/roundSummary.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { formatRoundSummary } from "./roundSummary";
const q = (id: string, ms: number, correct: boolean, tries = 1) => ({ id, ms, correct, tries });
describe("formatRoundSummary", () => {
  it("full round", () => {
    const text = formatRoundSummary({ date: "2026-08-22T10:00:00Z", totalMs: 252_000, score: 18, perQuestion: [
      q("4821+6130", 58_000, true), q("1000+2000", 5000, true), q("1111+2222", 5000, true), q("1234+5678", 5000, true), q("2000+3000", 5000, true),
      q("67-29", 9000, false), q("50-25", 4000, true, 2), q("10-3", 3000, true), q("90-45", 3000, true), q("80-1", 2000, true),
      q("23×4", 7000, true), q("12×9", 7000, true, 2), q("45×2", 6000, true), q("99×9", 9000, true), q("10×2", 2000, true),
      q("84÷7", 12_000, false), q("36÷6", 3000, true, 2), q("144÷12", 5000, true), q("18÷2", 2000, true), q("27÷3", 2000, true),
    ]});
    expect(text).toBe([
      "🔢 Aoife Math — round done (4 min 12 s) · 18/20",
      "+ 5/5   − 4/5   × 5/5   ÷ 4/5",
      "Missed: 67 − 29, 84 ÷ 7",
      "Needed 2 tries: 3",
      "Slowest: 4821 + 6130 (58 s)",
    ].join("\n"));
  });
  it("omits empty lines and handles missing tries", () => {
    const text = formatRoundSummary({ date: "x", totalMs: 61_000, score: 2, perQuestion: [
      { id: "1+1", ms: 1000, correct: true }, { id: "2÷1", ms: 2000, correct: true },
    ]});
    expect(text).toBe(["🔢 Aoife Math — round done (1 min 1 s) · 2/20", "+ 1/1   − 0/0   × 0/0   ÷ 1/1", "Slowest: 2 ÷ 1 (2 s)"].join("\n"));
  });
  it("no timings → no slowest line", () => {
    expect(formatRoundSummary({ date: "x", totalMs: 0, score: 0, perQuestion: [] })).toBe("🔢 Aoife Math — round done (0 s) · 0/20\n+ 0/0   − 0/0   × 0/0   ÷ 0/0");
  });
});
```

- [ ] **Step 5: run** `npm test` → FAIL (module not found).

- [ ] **Step 6: implement `lib/roundSummary.ts`**
```ts
import type { RoundLog } from "./types";
const OPS = ["+", "-", "×", "÷"] as const;
const DISPLAY: Record<string, string> = { "+": "+", "-": "−", "×": "×", "÷": "÷" };
const TOTAL = 20;
const opOf = (id: string) => OPS.find((o) => id.includes(o)) ?? "+";
const pretty = (id: string) => { const o = opOf(id); const [a, b] = id.split(o); return `${a} ${DISPLAY[o]} ${b}`; };
const clock = (ms: number) => { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`; };
export function formatRoundSummary(log: RoundLog): string {
  const lines = [`🔢 Aoife Math — round done (${clock(log.totalMs)}) · ${log.score}/${TOTAL}`];
  lines.push(OPS.map((o) => { const qs = log.perQuestion.filter((q) => opOf(q.id) === o); return `${DISPLAY[o]} ${qs.filter((q) => q.correct).length}/${qs.length}`; }).join("   "));
  const missed = log.perQuestion.filter((q) => !q.correct).map((q) => pretty(q.id));
  if (missed.length) lines.push(`Missed: ${missed.join(", ")}`);
  const retries = log.perQuestion.filter((q) => q.correct && (q.tries ?? 1) > 1).length;
  if (retries) lines.push(`Needed 2 tries: ${retries}`);
  const slowest = log.perQuestion.reduce<typeof log.perQuestion[number] | null>((m, q) => (q.ms > 0 && (!m || q.ms > m.ms) ? q : m), null);
  if (slowest) lines.push(`Slowest: ${pretty(slowest.id)} (${clock(slowest.ms)})`);
  return lines.join("\n");
}
```

- [ ] **Step 7: run** `npm test` → PASS. `npm run lint` clean.
- [ ] **Step 8: commit** `git add -A && git commit -m "Add round summary formatter + vitest"`

### Task 2: Telegram sender + API route

**Files:** Create `lib/telegram.ts`, `app/api/rounds/route.ts`

- [ ] **Step 1: `lib/telegram.ts`** — verbatim `sendTelegram` from `~/PycharmProjects/aoife-puzzles/lib/engine/telegram.ts` (no formatPartSummary). Uses `TELEGRAM_TOKEN` / `TELEGRAM_CHAT_ID`, `parse_mode: "HTML"`, never throws.
- [ ] **Step 2: `app/api/rounds/route.ts`**
```ts
import { NextResponse } from "next/server";
import { formatRoundSummary } from "@/lib/roundSummary";
import { sendTelegram } from "@/lib/telegram";
import type { RoundLog } from "@/lib/types";
const isLog = (x: unknown): x is RoundLog => { const l = x as RoundLog; return !!l && typeof l.totalMs === "number" && typeof l.score === "number" && Array.isArray(l.perQuestion) && l.perQuestion.every((q) => typeof q?.id === "string" && q.id.length <= 20 && typeof q.ms === "number" && typeof q.correct === "boolean"); };
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 50_000) return NextResponse.json({ error: "too-large" }, { status: 413 });
  let body: unknown; try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad-json" }, { status: 400 }); }
  if (!isLog(body)) return NextResponse.json({ error: "bad-round" }, { status: 400 });
  const notified = await sendTelegram(formatRoundSummary(body));
  return NextResponse.json({ ok: true, notified });
}
```
  HTML parse mode: the summary contains no `<`, `&` or `>` (ids are digits + operators), so no escaping needed; add `escapeHtml` only if `pretty` ever emits them — it can't.
- [ ] **Step 3:** `npm run build` green (route appears as `ƒ /api/rounds`). Commit: "Add /api/rounds → Telegram".

### Task 3: Client wiring in `app/page.tsx`

**Files:** Modify `app/page.tsx`

- [ ] **Step 1:** replace the local `RoundQuestionLog`/`RoundLog` interfaces with `import type { RoundLog, RoundQuestionLog } from "@/lib/types";`
- [ ] **Step 2:** record tries: in `handleAnswer`, the two `perQuestionRef.current.push(...)` calls gain `tries: attempt` (correct branch) and `tries: 2` (show-answer branch).
- [ ] **Step 3:** add `postRound` next to `saveRoundLog`:
```ts
// Parent alert: POST the round to /api/rounds (→ Telegram). Fire-and-forget, 3 tries, never throws.
const postRound = async (log: RoundLog) => {
  const body = JSON.stringify(log);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/rounds", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (res.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  console.error("Round alert not delivered");
};
```
- [ ] **Step 4:** in `finishRound`, build the log once: `const log = {...}; saveRoundLog(log); void postRound(log); setGameState("ended");`
- [ ] **Step 5:** `npm run lint && npm run build` green. Commit: "Send each finished round to /api/rounds".

### Task 4: Vercel env + deploy + live verification

- [ ] **Step 1:** `source ~/PycharmProjects/.secrets/telegram.env` (vars `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` — check the actual names in the file first) and `printf %s "$TELEGRAM_TOKEN" | vercel env add TELEGRAM_TOKEN production`, same for `TELEGRAM_CHAT_ID`. Never echo the values.
- [ ] **Step 2:** `vercel --prod --yes` from the repo root. Confirm the deployment URL is aoife-math.vercel.app.
- [ ] **Step 3:** fixture POST: `curl -s -X POST https://aoife-math.vercel.app/api/rounds -H 'Content-Type: application/json' -d @scratch/fixture.json` → `{"ok":true,"notified":true}` and the message is in Telegram.
- [ ] **Step 4:** bad body → 400; oversized → 413.
- [ ] **Step 5:** `git push origin main`.

### Task 5: Docs

- [ ] **Step 1:** AGENTS.md: update "no backend/no API/no env vars" claims; add §6 "Telegram round alerts" (route, env vars, where secrets live, the retry behaviour, `tries` field); fix the deploy line (manual `vercel --prod --yes`, GitHub auto-deploy not connected) if Step 4.2 confirms it; add `npm test`.
- [ ] **Step 2:** Commit + push. Update the memory file `project_aoife_math.md`.
