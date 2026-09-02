import type { ApiErrorPayload } from "../shared/types";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const payload = await response.json().catch(() => ({})) as T | ApiErrorPayload;
  if (!response.ok) {
    const error = payload as ApiErrorPayload;
    throw new ApiError(error.error || `HTTP ${response.status}`, response.status, error.details);
  }
  return payload as T;
}

export function postJson<T>(path: string, body: unknown, method = "POST") {
  return api<T>(path, { method, body: JSON.stringify(body) });
}
