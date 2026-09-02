import { describe, expect, it } from "vitest";
import { createMailProvider, getProviderStatus } from "../worker/providers";

describe("production mail provider readiness", () => {
  it("reports missing Garoon secrets without falling back to mock", () => {
    const status = getProviderStatus({
      ENVIRONMENT: "production",
      MAIL_PROVIDER: "garoon",
    });
    expect(status.ready).toBe(false);
    expect(status.provider).toBe("garoon");
    expect(status.missing).toEqual([
      "Garoon URL",
      "Garoonログイン名",
      "Garoonパスワード",
      "メールアカウントID",
    ]);
  });

  it("enables production sending only when all Garoon values are present", () => {
    const status = getProviderStatus({
      ENVIRONMENT: "production",
      MAIL_PROVIDER: "garoon",
      GAROON_BASE_URL: "https://example.cybozu.com/",
      GAROON_USERNAME: "sales-user",
      GAROON_PASSWORD: "secret",
      GAROON_ACCOUNT_ID: "1",
    });
    expect(status.ready).toBe(true);
    expect(status.label).toBe("Garoon本番送信");
  });

  it("fails closed if production is accidentally configured as mock", () => {
    const env = { ENVIRONMENT: "production", MAIL_PROVIDER: "mock" };
    expect(getProviderStatus(env).ready).toBe(false);
    expect(() => createMailProvider(env)).toThrow("本番環境でモック送信は使用できません");
  });
});
