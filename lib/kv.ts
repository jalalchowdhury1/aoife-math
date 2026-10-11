// Server-only Upstash Redis REST client, same env names as aoife-puzzles (KV_REST_API_URL/TOKEN,
// or the raw Upstash names). Its only job: remember which rounds were already sent to Telegram.
//
// HARD RULE: every key MUST go through PREFIX. This DB is shared with aoife-puzzles and the
// homeschool planner.
import type { Claims } from "./notifyOnce";

const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const PREFIX = "aoife_math:";
const CLAIM_TTL_S = 2 * 24 * 60 * 60; // a retry comes within seconds; 2 days is plenty

async function cmd<T = unknown>(...args: (string | number)[]): Promise<T> {
  const res = await fetch(url()!, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(3000),
  });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(j.error ?? `kv ${res.status}`);
  return j.result as T;
}

/** Round-alert claims backed by KV, or null when KV isn't configured. */
export const roundClaims = (): Claims | null =>
  url() && token()
    ? {
        claim: (k) => cmd<string | null>("SET", PREFIX + k, "1", "NX", "EX", CLAIM_TTL_S).then((r) => r === "OK"),
        release: (k) => cmd("DEL", PREFIX + k).then(() => undefined),
      }
    : null;

// Day card (11 Oct 2026): a finished round's summary waits in a hash for the health hub's
// 4 PM card instead of going to Telegram. aoife_math:daycard:<ET day>, field per round, kept 3 days.
export const CARD_TTL_S = 3 * 24 * 60 * 60;
export const kvReady = () => !!(url() && token());
export async function stashCardItem(day: string, field: string, value: string): Promise<void> {
  const key = `${PREFIX}daycard:${day}`;
  await cmd("HSET", key, field, value);
  await cmd("EXPIRE", key, CARD_TTL_S);
}
