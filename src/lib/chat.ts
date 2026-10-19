/** Chat media stays inside the message row and disappears after 7 days. No Storage bucket. */

export const CHAT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CHAT_IMAGE_MAX = 90_000;
export const CHAT_AUDIO_MAX = 70_000;
export const CHAT_AUDIO_SECONDS = 20;

export function chatExpiresAt(from = Date.now()) {
  return new Date(from + CHAT_TTL_MS).toISOString();
}

export function chatAlive(row: { created_at: string; expires_at?: string | null }, now = Date.now()) {
  const exp = row.expires_at
    ? new Date(row.expires_at).getTime()
    : new Date(row.created_at).getTime() + CHAT_TTL_MS;
  return exp > now;
}

export function chatPreview(row: { body?: string; image_url?: string | null; audio_url?: string | null }) {
  if (row.audio_url) return "Voice message";
  if (row.image_url && row.body) return row.body;
  if (row.image_url) return "Photo";
  return row.body || "";
}

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
}
