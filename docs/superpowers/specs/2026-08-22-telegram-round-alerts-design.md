# Telegram round alerts — design (2026-08-22)

## Goal

Mirror the aoife-puzzles behaviour: when Aoife finishes a round of aoife-math, Jalal gets
one Telegram message in the @ZingerJC_bot DM summarising the round. Nothing changes on
screen for Aoife; the no-visible-timer rule (AGENTS.md §2) is untouched — time goes to the
parent's phone, never to the child's screen.

## What is sent (one message per finished round)

```
🔢 Aoife Math — round done (4 min 12 s) · 18/20
+ 5/5   − 4/5   × 5/5   ÷ 4/5
Missed: 67 − 29, 84 ÷ 7
Needed 2 tries: 3
Slowest: 4821 + 6130 (58 s)
```

- Header: total round time (clock starts on first numpad press, as today) and score /20.
- Per-operation line: correct/asked for each of + − × ÷, derived from the question ids
  (`1234+5678`, `67-29`, `23×4`, `84÷7`) — no new data needed.
- `Missed:` the questions logged incorrect (answer revealed on attempt 2), using the display
  minus `−`. Omitted when none.
- `Needed 2 tries:` count of questions answered correctly only on the second attempt.
  Requires a new per-question field `tries: 1 | 2` in the round log (today the log only
  records `correct`). Omitted when 0.
- `Slowest:` the question with the largest `ms`, shown in seconds. Omitted if no timings.

## Architecture

```
app/page.tsx            finishRound(): save to localStorage (unchanged) + postRound(log)
lib/telegram.ts         sendTelegram(html) — copy of aoife-puzzles lib/engine/telegram.ts
lib/roundSummary.ts     formatRoundSummary(log): pure, unit-testable, builds the text above
app/api/rounds/route.ts POST: validate body → formatRoundSummary → sendTelegram → {ok, notified}
```

- `postRound` in the client: `fetch("/api/rounds", {method:"POST", body})`, up to 3 attempts
  with 2 s / 4 s backoff, fire-and-forget (never blocks the end screen, never throws).
- The route is unauthenticated: it accepts only a round-log shape (size-capped, fields
  type-checked) and can read nothing back. Same posture as puzzles' public POST.
- No KV / database. Round history stays in localStorage as today. Duplicate messages are
  only possible if the server succeeded but the client never saw the response and retried —
  acceptable for a parent notification.
- Env vars on Vercel project `aoife-math`: `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, copied from
  `~/PycharmProjects/.secrets/telegram.env`. Missing vars → route returns `{ok:true,
  notified:false}` and the game is unaffected.

## Data change

`RoundQuestionLog` gains `tries: number` (1 or 2). Old entries in localStorage without the
field still render in the parent peek overlay (the overlay does not read it). The server
treats a missing `tries` as 1.

## Error handling

- `sendTelegram` never throws (returns false).
- Route returns 400 on malformed body, 413 over 50 KB, 200 `{ok:true, notified:boolean}` otherwise.
- Client swallows all fetch errors after the retries; logs to console only.

## Testing

- Vitest is NOT in this repo (AGENTS.md: "no tests"). Add a minimal `vitest` dev dependency
  with one test file `lib/roundSummary.test.ts` covering: per-op tallies, missed list,
  second-tries count, slowest, and the "omitted when empty" lines. `npm test` script added.
- Manual: `curl -X POST https://aoife-math.vercel.app/api/rounds -d @fixture.json` → message
  arrives in Telegram; then a real round in Chrome.

## Deploy

`vercel --prod --yes` from the repo root (GitHub auto-deploy is not connected — the
Vercel GitHub App lacks access to this repo; AGENTS.md to be corrected on this point).
