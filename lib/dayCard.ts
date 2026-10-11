// Day card (11 Oct 2026). Jalal's call: ONE 4 PM card from the health hub replaces the
// per-round Telegram ping ("card replaces pings"). A finished round's summary is stashed
// in KV (aoife_math:daycard:<ET day>) and the health hub (lib/daycard.js there) sends it
// inside the card. Same boolean contract as sendTelegram, so notifyOnce is unchanged:
// false = not stored → the claim is released and the client re-POSTs. With no KV
// configured it falls back to the old direct ping — never silent.
import { kvReady, stashCardItem } from "./kv";
import { sendTelegram } from "./telegram";

export interface DayCardDeps {
  ready: () => boolean;
  stash: (day: string, field: string, value: string) => Promise<void>;
  send: (text: string) => Promise<boolean>;
}
const live: DayCardDeps = { ready: kvReady, stash: stashCardItem, send: sendTelegram };

/** ET calendar day (YYYY-MM-DD) of an ISO time; today's for a bad value. */
export function etDay(iso: string): string {
  const t = Date.parse(iso);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(Number.isFinite(t) ? new Date(t) : new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

export async function toDayCard(atIso: string, text: string, deps: DayCardDeps = live): Promise<boolean> {
  if (!deps.ready()) return deps.send(text);
  try {
    await deps.stash(etDay(atIso), `math:${atIso}`, JSON.stringify({ app: "math", at: atIso, text }));
    return true;
  } catch (e) {
    console.error(`[day-card] stash FAILED app=aoife-math: ${(e as Error).message}`);
    return false;
  }
}
