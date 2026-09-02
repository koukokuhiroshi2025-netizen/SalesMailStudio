import { GaroonProvider } from "./garoon";
import { MockProvider } from "./mock";
import type { GaroonCredentials, MailProvider } from "./types";

interface ProviderEnv {
  MAIL_PROVIDER: string;
  GAROON_BASE_URL?: string;
  GAROON_USERNAME?: string;
  GAROON_PASSWORD?: string;
  GAROON_ACCOUNT_ID?: string;
  GAROON_BASIC_USERNAME?: string;
  GAROON_BASIC_PASSWORD?: string;
}

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

export function createMailProvider(
  env: ProviderEnv,
  overrides?: Partial<GaroonCredentials>,
): MailProvider {
  if (env.MAIL_PROVIDER === "garoon" || overrides?.baseUrl) {
    return new GaroonProvider(getGaroonCredentials(env, overrides));
  }
  return new MockProvider();
}
