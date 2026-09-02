const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Cache-Control": "no-store",
};

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=UTF-8");
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  return Response.json(data, { ...init, headers });
}

export function apiError(message: string, status = 400, details?: unknown) {
  return json({ error: message, ...(details === undefined ? {} : { details }) }, { status });
}

export async function readJson<T>(request: Request, maxBytes = 2_000_000): Promise<T> {
  if (!request.body) throw new Error("リクエスト本文がありません");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("リクエストサイズが上限を超えています");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("リクエストサイズが上限を超えています");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new Error("許可されていないオリジンからのリクエストです");
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new Error("Content-Typeはapplication/jsonで送信してください");
  }
}
