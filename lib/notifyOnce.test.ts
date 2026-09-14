import { describe, it, expect } from "vitest";
import { notifyOnce, type Claims } from "./notifyOnce";

// In-memory stand-in for the KV SET NX claim.
const memoryClaims = () => {
  const held = new Set<string>();
  const claims: Claims = {
    claim: async (k) => (held.has(k) ? false : (held.add(k), true)),
    release: async (k) => void held.delete(k),
  };
  return { claims, held };
};

const sender = (ok = true) => {
  let calls = 0;
  const send = async () => (calls++, ok);
  return { send, calls: () => calls };
};

describe("notifyOnce", () => {
  it("sends the first time and skips a retry of the same round", async () => {
    const { claims } = memoryClaims();
    const s = sender();
    expect(await notifyOnce("notified:2026-09-14T10:00:00.000Z", s.send, claims)).toBe("sent");
    expect(await notifyOnce("notified:2026-09-14T10:00:00.000Z", s.send, claims)).toBe("duplicate");
    expect(s.calls()).toBe(1);
  });

  it("sends each different round", async () => {
    const { claims } = memoryClaims();
    const s = sender();
    await notifyOnce("notified:a", s.send, claims);
    await notifyOnce("notified:b", s.send, claims);
    expect(s.calls()).toBe(2);
  });

  it("gives the claim back when the send fails, so a retry can still deliver", async () => {
    const { claims, held } = memoryClaims();
    expect(await notifyOnce("notified:a", sender(false).send, claims)).toBe("failed");
    expect(held.has("notified:a")).toBe(false);
    const s = sender();
    expect(await notifyOnce("notified:a", s.send, claims)).toBe("sent");
    expect(s.calls()).toBe(1);
  });

  it("sends unguarded when KV is not configured", async () => {
    const s = sender();
    expect(await notifyOnce("notified:a", s.send, null)).toBe("sent");
    expect(await notifyOnce("notified:a", s.send, null)).toBe("sent");
    expect(s.calls()).toBe(2);
  });

  it("sends unguarded when KV throws", async () => {
    const broken: Claims = {
      claim: async () => { throw new Error("kv down"); },
      release: async () => { throw new Error("kv down"); },
    };
    const s = sender();
    expect(await notifyOnce("notified:a", s.send, broken)).toBe("sent");
    expect(s.calls()).toBe(1);
  });
});
