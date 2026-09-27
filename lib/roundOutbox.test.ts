import { describe, it, expect } from "vitest";
import { enqueueRound, flushRounds, loadOutbox, MAX_TRIES } from "./roundOutbox";
import type { RoundLog } from "./types";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const log = (date: string): RoundLog => ({ date, totalMs: 1000, score: 20, perQuestion: [] });
const reply = (ok: boolean, body: unknown) => async () => ({ ok, json: async () => body });

describe("round outbox", () => {
  it("drops a round once the server says notified", async () => {
    const s = mem();
    enqueueRound(log("2026-09-27T10:00:00.000Z"), s);
    expect(await flushRounds(reply(true, { ok: true, notified: true }), s)).toBe(0);
    expect(loadOutbox(s)).toEqual([]);
  });

  it("drops a duplicate (already pinged earlier)", async () => {
    const s = mem();
    enqueueRound(log("a"), s);
    expect(await flushRounds(reply(true, { ok: true, notified: false, duplicate: true }), s)).toBe(0);
  });

  it("keeps the round on a failed ping (503) and delivers it on a later flush", async () => {
    const s = mem();
    enqueueRound(log("a"), s);
    expect(await flushRounds(reply(false, { ok: false, notified: false, retry: true }), s)).toBe(1);
    expect(loadOutbox(s)[0].tries).toBe(1);
    expect(await flushRounds(reply(true, { ok: true, notified: true }), s)).toBe(0);
  });

  it("keeps a 200 that did not notify (old server shape) — only notified:true ends it", async () => {
    const s = mem();
    enqueueRound(log("a"), s);
    expect(await flushRounds(reply(true, { ok: true, notified: false }), s)).toBe(1);
  });

  it("keeps the round untouched when offline", async () => {
    const s = mem();
    enqueueRound(log("a"), s);
    const offline = async () => { throw new Error("offline"); };
    expect(await flushRounds(offline, s)).toBe(1);
    expect(loadOutbox(s)[0].tries).toBe(0);
  });

  it("gives up after MAX_TRIES failed pings", async () => {
    const s = mem();
    enqueueRound(log("a"), s);
    for (let i = 0; i < MAX_TRIES; i++) await flushRounds(reply(false, { retry: true }), s);
    expect(loadOutbox(s)).toEqual([]);
  });

  it("drops bodies the server rejects as malformed", async () => {
    const s = mem();
    enqueueRound(log("a"), s);
    expect(await flushRounds(reply(false, { error: "bad-round" }), s)).toBe(0);
  });

  it("re-queueing the same round replaces it, never doubles it", () => {
    const s = mem();
    enqueueRound(log("a"), s);
    enqueueRound(log("a"), s);
    expect(loadOutbox(s)).toHaveLength(1);
  });

  it("the same round POSTed on every retry (the server dedupes by its date)", async () => {
    const s = mem();
    enqueueRound(log("2026-09-27T10:00:00.000Z"), s);
    const bodies: string[] = [];
    const f = async (_u: string, i: RequestInit) => (bodies.push(String(i.body)), { ok: false, json: async () => ({ retry: true }) });
    await flushRounds(f, s);
    await flushRounds(f, s);
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0]).date).toBe("2026-09-27T10:00:00.000Z");
  });
});
