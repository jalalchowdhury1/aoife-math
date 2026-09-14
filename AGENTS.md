# AGENTS.md — Aoife Math (consolidated daily practice)

> **Single source of truth for anyone (human or AI) touching this repo.** Read it fully
> before changing code or "fixing" anything. If something here is wrong, fix *this* file.

This is the **consolidation of four older single-operation games** into one site. The
old repos — `aoife-math-game` (4-digit addition), `long-subtraction-aoife` (subtraction
to 100), `aoife-subtraction-game` (quick ≤20 subtraction), and `aoife-math-2a`
(Singapore 2A drills) — are superseded by this one and **will be deleted by the owner
after a few days of validating this site**. Until then they remain live; don't touch them
from here.

A tiny, single-page math practice game for a child named Aoife. There is **no database
(one KV key per round, only to stop double alerts, §6), no auth, no CI**. Almost the entire app is one file: `app/page.tsx`; the only server code
is `app/api/rounds/route.ts`, which turns a finished round into a Telegram message for
the parent (§6). Tests: Vitest, `lib/**/*.test.ts` only.

---

## 1. What this is

A **Next.js 16 (App Router) + React 19 + Tailwind v4** static client-side web app. One
round = **20 questions, exactly 5 of each operation, fully shuffled together**:

| Operation | Generator (`app/page.tsx`) | Range |
|---|---|---|
| Addition | `genAddition` | 4-digit + 4-digit (1000–9999 each), sum ≤ 13,000 |
| Subtraction | `genSubtraction` | num1 1–100, num2 1–num1 (answer ≥ 0) |
| Multiplication | `genMultiplication` | double-digit × single-digit: 10–99 × 2–9 |
| Division | `genDivision` | inverse times-table facts: divisor 2–12, quotient 2–12, dividend = divisor×quotient (≤144), always exact |

Questions are **freshly random every round** (`Math.random()` at init). There is
deliberately **no adaptive learning, no struggling-patterns engine, no repeat list** —
the older repos had one; it was intentionally dropped here because she's past needing it.

- **Trigger / run model:** a browser page. No schedule, no cron. `app/page.tsx` is a
  `"use client"` component; all game logic runs in the browser. The one server route,
  `POST /api/rounds`, is called once per finished round (§6).
- **Deploy target:** **Vercel**, zero-config Next.js (no `vercel.json`). Repo:
  `github.com/jalalchowdhury1/aoife-math` (public). **GitHub auto-deploy is NOT connected**
  (the Vercel GitHub App lacks access to this repo) — pushing to `main` does nothing on
  Vercel. Deploy with `vercel --prod --yes` from the repo root, then push.
- **No external runtime dependencies.** `canvas-confetti` is bundled from npm (imported
  in `app/page.tsx`) so confetti works offline / on flaky wifi. The predecessor repos
  loaded it from a CDN — that was deliberately changed here; don't reintroduce the CDN
  `next/script` tag.
- **Fonts:** Geist via `next/font/google` (CSS variables), kid-facing font is
  `Bubblegum Sans` from Google Fonts CSS in `app/globals.css` (Tailwind `font-bubble`).

## 2. The timer rule (IMPORTANT — do not "improve" this)

**Round time IS recorded but is NEVER displayed anywhere Aoife can see it.** A visible
timer distracts her — she races it and accuracy drops. The owner explicitly removed the
timer display from the predecessor games for the same reason.

- The clock starts on her **first numpad press** (not page load) and stops at the final
  answer. Per-question times are also captured.
- Round logs are appended to `localStorage["aoife-math-times"]` (constant `TIMES_KEY`),
  capped at the last 60 rounds: `{ date, totalMs, score, perQuestion: [{id, ms, correct, tries}] }`
  (types in `lib/types.ts`; `tries` = 1 or 2, added 2026-08-22, absent in older entries).
- **Parent peek:** 5 quick taps (within 2s) on the round counter ("3 / 20", top-left
  during play) or on the end-screen emoji opens a hidden overlay listing recent rounds
  (date, time, score). That overlay is the ONLY place time is ever shown.
- Do not add a visible timer, a best-time display, or time on the end screen.

## 3. Game mechanics

State machine (`GameState`): `loading → playing ⇄ success / try-again / show-answer → ended`.

Per question (`handleAnswer`):
- correct → score+1, confetti, green flash, 1.5s pause → next question
- wrong #1 → "try again" amber flash, input cleared, attempt 2, 1.5s pause → playing
- wrong #2 → answer revealed in purple, logged incorrect, 2.5s pause → next question

Numpad: digits build the answer (capped at `MAX_INPUT` = 13,000, the largest possible
answer), `C` clears, `✔️` submits (disabled when empty). End screen shows score /20 and
Play Again (full reshuffle). The displayed minus sign is `−` (U+2212) via `OP_DISPLAY`;
question ids use ASCII `-`.

## 4. Repo layout

```
app/page.tsx              — the entire game (generators, state machine, UI, time log, parent peek, postRound)
app/layout.tsx            — metadata, fonts
app/globals.css           — Tailwind v4 CSS-first theme (pink/purple, Bubblegum Sans)
app/api/rounds/route.ts   — POST a RoundLog → Telegram summary (§6)
lib/types.ts              — RoundLog / RoundQuestionLog (shared by page, overlay and route)
lib/roundSummary.ts       — formatRoundSummary(log): pure, unit-tested message builder
lib/telegram.ts           — sendTelegram(html): copy of aoife-puzzles' sender, never throws
docs/superpowers/         — specs + plans (2026-08-22 Telegram round alerts)
```

`npm run dev` / `npm run build` / `npm run lint` / `npm test` (Vitest). Install with
`npm install --cache ./.npm-cache` (the global npm cache on this Mac is corrupted).
Env vars (Vercel only, production): `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` — see §6. No
secrets in the repo; nothing else is configured.

## 5. Gotchas

- **Never commit `node_modules` or npm caches.** The old `aoife-subtraction-game` repo
  has 469MB of committed `.npm-cache` — that mistake is why `.gitignore` here also lists
  `.npm-cache/`.
- The end-of-round branch keys off `currentQuestionIndex === TOTAL_QUESTIONS - 1`; the
  predecessor repo had a bug where this was hardcoded to the wrong count after changing
  round size. Change `TOTAL_QUESTIONS`/`QUESTIONS_PER_OP` together and nowhere else.
- `buildRound()` dedupes by question id *within* a round; across days repeats are fine
  and expected.

## 6. Telegram round alerts (added 2026-08-22)

Mirrors aoife-puzzles: **one Telegram message per finished round** to Jalal's
@ZingerJC_bot DM. Aoife never sees any of it; the no-timer rule (§2) is untouched — time
goes to the parent's phone only.

- Flow: `finishRound()` in `app/page.tsx` builds the `RoundLog`, saves it to localStorage
  (as before) and calls `postRound(log)` → `fetch("/api/rounds")`, fire-and-forget, **3
  attempts with 2 s / 4 s / 6 s backoff**, never blocks the end screen, never throws.
- `app/api/rounds/route.ts`: unauthenticated on purpose — it accepts only a size-capped
  (50 KB, ≤40 questions) type-checked `RoundLog` whose ids match `/^[0-9+\-×÷]+$/`, and
  can read nothing back. Returns 400 (bad JSON / shape), 413 (too big), or 200
  `{ ok: true, notified: boolean }`. Missing env vars → `notified: false`, game unaffected.
- Message (built by `lib/roundSummary.ts`, see its test for the exact shape):
  ```
  🔢 Aoife Math — round done (4 min 12 s) · 18/20
  + 5/5   − 4/5   × 5/5   ÷ 4/5
  Missed: 67 − 29, 84 ÷ 7
  Needed 2 tries: 3
  Slowest: 4821 + 6130 (58 s)
  ```
  Per-op tallies come from the question ids (`1234+5678`, `67-29`, `23×4`, `84÷7`). `Missed`,
  `Needed 2 tries` and `Slowest` lines are omitted when empty.
- Env: `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` on the Vercel
  project `aoife-math` (production; the KV pair is aoife-puzzles' values),
  copied from `~/PycharmProjects/.secrets/telegram.env` (same bot/chat as aoife-puzzles).
  Add with `printf %s "$VAR" | vercel env add VAR production`; never paste values anywhere.
- No double alerts (added 2026-09-14): the route claims `aoife_math:notified:<round date>` in
  the Upstash KV shared with aoife-puzzles (`SET NX EX` 2 days, `lib/kv.ts`) before sending, and
  deletes the claim if the send fails (`lib/notifyOnce.ts`, tested). A retry of the same round
  gets `{ notified: true, duplicate: true }` and no second message. `finishRound()` also runs
  once per round (`roundFinishedRef`). KV env missing or KV down → it sends unguarded; a double
  ping beats a missing one. Round history still lives only in localStorage (iPad Safari drops it
  after 7 days without a visit).
- Verified live 2026-08-22: fixture POST → `notified: true`; a scripted full round in Chrome
  (one miss, one second try) produced the expected message.
