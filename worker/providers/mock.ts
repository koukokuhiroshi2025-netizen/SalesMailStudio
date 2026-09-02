import type { ConnectionResult, MailProvider, OutgoingMail, ProviderResult } from "./types";

export class MockProvider implements MailProvider {
  async testConnection(): Promise<ConnectionResult> {
    return { success: true, message: "モック送信環境に接続しました" };
  }

  async sendMail(_message: OutgoingMail): Promise<ProviderResult> {
    return { success: true, providerMessageId: `mock-${crypto.randomUUID()}` };
  }

  async saveDraft(_message: OutgoingMail): Promise<ProviderResult> {
    return { success: true, providerMessageId: `mock-draft-${crypto.randomUUID()}` };
  }
}
