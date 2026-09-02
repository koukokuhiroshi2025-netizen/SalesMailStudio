import { GaroonProvider } from "./garoon";
import { MockProvider } from "./mock";
import type { GaroonCredentials, MailProvider } from "./types";

interface ProviderEnv {
  ENVIRONMENT?: string;
  MAIL_PROVIDER: string;
  GAROON_BASE_URL?: string;
  GAROON_USERNAME?: string;
  GAROON_PASSWORD?: string;
  GAROON_ACCOUNT_ID?: string;
  GAROON_BASIC_USERNAME?: string;
  GAROON_BASIC_PASSWORD?: string;
}

export interface ProviderStatus {
  provider: "mock" | "garoon";
  label: string;
  ready: boolean;
  missing: string[];
}

const GAROON_REQUIREMENTS = [
  ["GAROON_BASE_URL", "Garoon URL"],
  ["GAROON_USERNAME", "Garoonログイン名"],
  ["GAROON_PASSWORD", "Garoonパスワード"],
  ["GAROON_ACCOUNT_ID", "メールアカウントID"],
] as const;

export function getGaroonCredentials(
  env: ProviderEnv,
  overrides?: Partial<GaroonCredentials>,
): GaroonCredentials {
  return {
    baseUrl: overrides?.baseUrl ?? env.GAROON_BASE_URL ?? "",
    username: overrides?.username ?? env.GAROON_USERNAME ?? "",
    password: overrides?.password ?? env.GAROON_PASSWORD ?? "",
    accountId: overrides?.accountId ?? env.GAROON_ACCOUNT_ID ?? "",
    basicUsername: overrides?.basicUsername ?? env.GAROON_BASIC_USERNAME,
    basicPassword: overrides?.basicPassword ?? env.GAROON_BASIC_PASSWORD,
  };
}

export function getProviderStatus(env: ProviderEnv): ProviderStatus {
  if (env.MAIL_PROVIDER !== "garoon") {
    const production = env.ENVIRONMENT === "production";
    return {
      provider: "mock",
      label: production ? "本番送信は無効" : "ローカルテスト",
      ready: !production,
      missing: production ? ["MAIL_PROVIDER=garoon"] : [],
    };
  }
  const values: Record<string, string | undefined> = {
    GAROON_BASE_URL: env.GAROON_BASE_URL,
    GAROON_USERNAME: env.GAROON_USERNAME,
    GAROON_PASSWORD: env.GAROON_PASSWORD,
    GAROON_ACCOUNT_ID: env.GAROON_ACCOUNT_ID,
  };
  const missing = GAROON_REQUIREMENTS
    .filter(([key]) => !values[key]?.trim())
    .map(([, label]) => label);
  return {
    provider: "garoon",
    label: "Garoon本番送信",
    ready: missing.length === 0,
    missing,
  };
}

export function createMailProvider(
  env: ProviderEnv,
  overrides?: Partial<GaroonCredentials>,
): MailProvider {
  if (overrides?.baseUrl) return new GaroonProvider(getGaroonCredentials(env, overrides));
  if (env.MAIL_PROVIDER === "garoon") return new GaroonProvider(getGaroonCredentials(env));
  if (env.ENVIRONMENT === "production") {
    throw new Error("本番環境でモック送信は使用できません");
  }
  return new MockProvider();
}
