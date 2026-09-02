import { describe, expect, it } from "vitest";
import { authenticateAccessToken, createSessionCookie } from "../worker/auth";

describe("administrator access link", () => {
  const env = {
    ENVIRONMENT: "production",
    ACCESS_TOKEN: "a-secure-access-token-with-more-than-32-characters",
    SESSION_SECRET: "a-session-secret-with-more-than-32-random-characters",
    DEMO_USER_EMAIL: "admin@example.com",
  };

  it("creates a long-lived administrator session for the valid token", async () => {
    const user = await authenticateAccessToken(env.ACCESS_TOKEN, env);
    expect(user?.email).toBe("admin@example.com");
    expect(user?.displayName).toBe("メール送信管理者");
    const cookie = await createSessionCookie(user!, env);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
  });

  it("rejects an invalid token", async () => {
    await expect(authenticateAccessToken("wrong-token-value-with-enough-characters", env)).resolves.toBeNull();
  });

  it("fails closed when the production token is missing", async () => {
    await expect(authenticateAccessToken("anything", {
      ENVIRONMENT: "production",
      SESSION_SECRET: env.SESSION_SECRET,
    })).rejects.toThrow("ACCESS_TOKEN");
  });
});
