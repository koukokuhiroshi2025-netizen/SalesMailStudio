export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  exp: number;
}

interface AuthEnv {
  ENVIRONMENT: string;
  SESSION_SECRET?: string;
  APP_PASSWORD?: string;
  DEMO_USER_EMAIL?: string;
}

const COOKIE_NAME = "sms_session";
const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function getSecret(env: AuthEnv) {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (env.ENVIRONMENT !== "production") return "local-development-session-secret-change-me";
  throw new Error("SESSION_SECRETが設定されていません");
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(value: string, secret: string) {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifySignature(value: string, signature: string, secret: string) {
  const key = await importHmacKey(secret);
  try {
    return await crypto.subtle.verify("HMAC", key, base64UrlToBytes(signature), encoder.encode(value));
  } catch {
    return false;
  }
}

async function hash(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function constantTimePasswordMatch(actual: string, expected: string) {
  const [left, right] = await Promise.all([hash(actual), hash(expected)]);
  let different = left.byteLength ^ right.byteLength;
  for (let index = 0; index < Math.max(left.byteLength, right.byteLength); index += 1) {
    different |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return different === 0;
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function authenticateCredentials(
  email: string,
  password: string,
  env: AuthEnv,
): Promise<SessionUser | null> {
  const expectedEmail = env.DEMO_USER_EMAIL ?? "sales@example.com";
  const expectedPassword = env.APP_PASSWORD ?? (env.ENVIRONMENT === "production" ? "" : "demo-pass");
  if (!expectedPassword) throw new Error("APP_PASSWORDが設定されていません");
  const [emailMatches, passwordMatches] = await Promise.all([
    constantTimePasswordMatch(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase()),
    constantTimePasswordMatch(password, expectedPassword),
  ]);
  if (!emailMatches || !passwordMatches) return null;
  return {
    id: "demo-user",
    email: expectedEmail,
    displayName: "営業企画チーム",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  };
}

export async function createSessionCookie(user: SessionUser, env: AuthEnv) {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify(user)));
  const signature = await sign(payload, getSecret(env));
  const secure = env.ENVIRONMENT === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${payload}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure}`;
}

export function clearSessionCookie(env: AuthEnv) {
  const secure = env.ENVIRONMENT === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export async function getSession(request: Request, env: AuthEnv): Promise<SessionUser | null> {
  const raw = readCookie(request, COOKIE_NAME);
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  if (!(await verifySignature(payload, signature, getSecret(env)))) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as SessionUser;
    if (session.exp < Math.floor(Date.now() / 1000) || session.id !== "demo-user") return null;
    return session;
  } catch {
    return null;
  }
}
