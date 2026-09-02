import { describe, expect, it } from "vitest";
import { campaignSchema } from "../worker/schemas";

const recipient = {
  company: "株式会社サンプル",
  name: "山田 太郎",
  email: "yamada@example.com",
};

const baseCampaign = {
  name: "今回の送信",
  recipients: [recipient],
  subject: "{{company}}様",
  body: "{{name}} 様",
  mode: "send",
  intervalSeconds: 10,
  confirmedCount: 1,
};

describe("transient campaign schema", () => {
  it("accepts recipient data uploaded for the current campaign", () => {
    const parsed = campaignSchema.safeParse(baseCampaign);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.recipients[0]?.email).toBe("yamada@example.com");
    }
  });

  it("rejects the legacy persisted contact id flow", () => {
    const parsed = campaignSchema.safeParse({
      ...baseCampaign,
      recipients: undefined,
      contactIds: ["contact-1"],
    });
    expect(parsed.success).toBe(false);
  });

  it("limits one upload to 500 recipients", () => {
    const parsed = campaignSchema.safeParse({
      ...baseCampaign,
      recipients: Array.from({ length: 501 }, (_, index) => ({
        ...recipient,
        email: `person-${index}@example.com`,
      })),
      confirmedCount: 501,
    });
    expect(parsed.success).toBe(false);
  });
});
