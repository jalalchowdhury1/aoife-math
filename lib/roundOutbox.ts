// Client outbox for the parent's round alert. Standing rule: every Aoife activity pings
// Jalal when she finishes — so a round stays queued in localStorage until the server says
// the Telegram message went out (`notified: true`, or `duplicate` = sent earlier). A failed
// send answers 503 from /api/rounds; the round is retried on the next flush (and on the
// next page load). The server's notified:<round date> claim stops a double ping.

import type { RoundLog } from "./types";

export const OUTBOX_KEY = "aoife-math-outbox";
export const MAX_TRIES = 20;

export interface OutboxItem {
  log: RoundLog;
  tries: number;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const store = (): StorageLike | null => (typeof localStorage !== "undefined" ? localStorage : null);

export function loadOutbox(s: StorageLike | null = store()): OutboxItem[] {
  try {
    const raw = s?.getItem(OUTBOX_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function saveOutbox(items: OutboxItem[], s: StorageLike | null): void {
  try {
    s?.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    // storage full / blocked: nothing else to do
  }
}

export function enqueueRound(log: RoundLog, s: StorageLike | null = store()): void {
  const items = loadOutbox(s).filter((i) => i.log.date !== log.date);
  items.push({ log, tries: 0 });
  saveOutbox(items, s);
}

/** POSTs every queued round; keeps the ones not yet notified. Returns how many are left. Never throws. */
export async function flushRounds(
  f: FetchLike = (u, i) => fetch(u, i),
  s: StorageLike | null = store(),
): Promise<number> {
  const items = loadOutbox(s);
  if (!items.length) return 0;
  const left: OutboxItem[] = [];
  for (const item of items) {
    try {
      const res = await f("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.log),
      });
      let body: { notified?: boolean; duplicate?: boolean; error?: string } = {};
      try {
        body = ((await res.json()) ?? {}) as typeof body;
      } catch {
        body = {};
      }
      if (res.ok && (body.notified === true || body.duplicate === true)) continue; // delivered
      // 400/413 = the server will never accept this body: drop it rather than retry forever
      if (body.error === "bad-round" || body.error === "bad-json" || body.error === "too-large") continue;
      if (item.tries + 1 < MAX_TRIES) left.push({ ...item, tries: item.tries + 1 });
    } catch {
      left.push(item); // offline: keep, don't count the try
    }
  }
  // Re-read: a new round may have been queued while we were POSTing.
  const known = new Set(items.map((i) => i.log.date));
  const added = loadOutbox(s).filter((i) => !known.has(i.log.date));
  saveOutbox([...left, ...added], s);
  return left.length + added.length;
}
