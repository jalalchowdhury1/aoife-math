// Server-only. Same sender as aoife-puzzles (lib/engine/telegram.ts): one message to the
// owner's @ZingerJC_bot DM via TELEGRAM_TOKEN / TELEGRAM_CHAT_ID. Never throws.

const API = (token: string) => `https://api.telegram.org/bot${token}/sendMessage`;

/** Sends one HTML-formatted Telegram message. Returns false on any failure or missing env. */
export async function sendTelegram(html: string): Promise<boolean> {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(API(token), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000), // a hung call must not leave the round's claim stuck
    });
    if (!res.ok) {
      const why = await res.text().catch(() => "");
      console.error(`[done-ping] telegram HTTP ${res.status} ${why.slice(0, 200)}`);
    }
    return res.ok;
  } catch (e) {
    console.error(`[done-ping] telegram error ${(e as Error)?.name ?? "unknown"}`);
    return false;
  }
}
