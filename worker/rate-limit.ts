import { apiError } from "./http";

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforceMutationRateLimit(request: Request, env: Env) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;

  const url = new URL(request.url);
  const actor = request.headers.get("Cookie")
    ?? request.headers.get("CF-Connecting-IP")
    ?? "anonymous";
  const actorDigest = toHex(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(actor),
  )).slice(0, 32);
  const { success } = await env.API_RATE_LIMITER.limit({
    key: `${actorDigest}:${url.pathname}`,
  });

  if (success) return null;
  console.warn(JSON.stringify({ event: "rate_limited", path: url.pathname }));
  return apiError("操作回数が上限を超えました。1分ほど待ってから再実行してください。", 429);
}
