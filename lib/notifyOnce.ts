// Send a round's Telegram alert at most once. The client retries a POST whose response it
// never saw (flaky wifi), and the server may already have sent that round's message, so the
// server claims the round's key before sending and gives it back if the send fails.
// No KV configured, or KV down → send anyway: a double ping beats a missing one.

export interface Claims {
  /** true = this call is the first to claim the key. */
  claim(key: string): Promise<boolean>;
  release(key: string): Promise<void>;
}

export type NotifyResult = "sent" | "duplicate" | "failed";

export async function notifyOnce(
  key: string,
  send: () => Promise<boolean>,
  claims: Claims | null,
): Promise<NotifyResult> {
  let claimed = false;
  if (claims) {
    try {
      if (!(await claims.claim(key))) return "duplicate";
      claimed = true;
    } catch {
      // KV unreachable: fall through and send unguarded
    }
  }
  if (await send()) return "sent";
  if (claimed) await claims!.release(key).catch(() => {});
  return "failed";
}
