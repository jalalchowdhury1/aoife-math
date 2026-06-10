# AGENTS.md — Aoife Math (consolidated daily practice)

> **Single source of truth for anyone (human or AI) touching this repo.** Read it fully
> before changing code or "fixing" anything. If something here is wrong, fix *this* file.

This is the **consolidation of four older single-operation games** into one site. The
old repos — `aoife-math-game` (4-digit addition), `long-subtraction-aoife` (subtraction
to 100), `aoife-subtraction-game` (quick ≤20 subtraction), and `aoife-math-2a`
(Singapore 2A drills) — are superseded by this one and **will be deleted by the owner
after a few days of validating this site**. Until then they remain live; don't touch them
from here.

A tiny, single-page math practice game for a child named Aoife. There is **no backend,
no database, no API, no auth, no tests, no CI**. Almost the entire app is one file:
`app/page.tsx`.

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

- **Trigger / run model:** purely a browser page. No schedule, no cron, no server route.
  `app/page.tsx` is a `"use client"` component; all logic runs in the browser.
- **Deploy target:** **Vercel**, zero-config Next.js, auto-deploys on push to `main`
  (no `vercel.json`). Repo: `github.com/jalalchowdhury1/aoife-math` (public).
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
  capped at the last 60 rounds: `{ date, totalMs, score, perQuestion: [{id, ms, correct}] }`.
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
app/page.tsx     — the entire game (generators, state machine, UI, time log, parent peek)
app/layout.tsx   — metadata, fonts, confetti CDN script
app/globals.css  — Tailwind v4 CSS-first theme (pink/purple, Bubblegum Sans)
```

`npm run dev` / `npm run build` / `npm run lint`. No env vars. No secrets.

## 5. Gotchas

- **Never commit `node_modules` or npm caches.** The old `aoife-subtraction-game` repo
  has 469MB of committed `.npm-cache` — that mistake is why `.gitignore` here also lists
  `.npm-cache/`.
- The end-of-round branch keys off `currentQuestionIndex === TOTAL_QUESTIONS - 1`; the
  predecessor repo had a bug where this was hardcoded to the wrong count after changing
  round size. Change `TOTAL_QUESTIONS`/`QUESTIONS_PER_OP` together and nowhere else.
- `buildRound()` dedupes by question id *within* a round; across days repeats are fine
  and expected.
