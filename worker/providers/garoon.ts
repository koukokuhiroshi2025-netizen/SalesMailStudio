import type {
  ConnectionResult,
  GaroonCredentials,
  MailProvider,
  OutgoingMail,
  ProviderResult,
} from "./types";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\r\n|\r|\n/g, "&#10;");
}

export function buildSoapEnvelope(
  action: string,
  parameters: string,
  credentials: Pick<GaroonCredentials, "username" | "password">,
  now = new Date(),
): string {
  const expires = new Date(now.getTime() + 5 * 60 * 1000);
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header>
    <Action>${escapeXml(action)}</Action>
    <Security>
      <UsernameToken>
        <Username>${escapeXml(credentials.username)}</Username>
        <Password>${escapeXml(credentials.password)}</Password>
      </UsernameToken>
    </Security>
    <Timestamp>
      <Created>${now.toISOString()}</Created>
      <Expires>${expires.toISOString()}</Expires>
    </Timestamp>
    <Locale>ja</Locale>
  </soap:Header>
  <soap:Body>
    <${action}>
      <parameters>${parameters}</parameters>
    </${action}>
  </soap:Body>
</soap:Envelope>`;
}

function validateGaroonBaseUrl(baseUrl: string): URL {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:") throw new Error("Garoon URLはhttps://で指定してください");
  if (url.username || url.password) throw new Error("Garoon URLに認証情報を含めないでください");
  if (!(url.hostname === "cybozu.com" || url.hostname.endsWith(".cybozu.com"))) {
    throw new Error("MVPではクラウド版Garoon（*.cybozu.com）のみ接続できます");
  }
  return url;
}

function extractSoapError(xml: string): string | undefined {
  const fault = xml.match(/<(?:\w+:)?(?:Fault|faultstring)[^>]*>([\s\S]*?)<\/(?:\w+:)?(?:Fault|faultstring)>/i);
  const description = xml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  return (description?.[1] ?? fault?.[1])?.replace(/<[^>]+>/g, "").trim();
}

export class GaroonProvider implements MailProvider {
  private readonly credentials: GaroonCredentials;
  private readonly origin: URL;

  constructor(credentials: GaroonCredentials) {
    this.credentials = credentials;
    this.origin = validateGaroonBaseUrl(credentials.baseUrl);
    if (!credentials.username || !credentials.password || !credentials.accountId) {
      throw new Error("Garoonのログイン名、パスワード、メールアカウントIDが必要です");
    }
  }

  private async call(service: "base" | "mail", action: string, parameters: string) {
    const endpoint = new URL(`/g/cbpapi/${service}/api.csp`, this.origin);
    const envelope = buildSoapEnvelope(action, parameters, this.credentials);
    const headers = new Headers({ "Content-Type": "text/xml; charset=UTF-8" });
    if (this.credentials.basicUsername && this.credentials.basicPassword) {
      const basic = btoa(`${this.credentials.basicUsername}:${this.credentials.basicPassword}`);
      headers.set("Authorization", `Basic ${basic}`);
    }
    const response = await fetch(endpoint, { method: "POST", headers, body: envelope });
    const text = await response.text();
    const soapError = extractSoapError(text);
    if (!response.ok || soapError) {
      throw new Error(soapError || `Garoon APIエラー（HTTP ${response.status}）`);
    }
    return text;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.call("base", "BaseGetApplicationStatus", "");
      return { success: true, message: "Garoonに接続しました" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Garoonへの接続に失敗しました",
      };
    }
  }

  async sendMail(message: OutgoingMail): Promise<ProviderResult> {
    try {
      const messageXml = this.buildMailXml("send", message);
      const result = await this.call("mail", "MailSendMails", messageXml);
      const id = result.match(/<mail[^>]+key="([^"]+)"/)?.[1];
      return { success: true, providerMessageId: id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "送信に失敗しました" };
    }
  }

  async saveDraft(message: OutgoingMail): Promise<ProviderResult> {
    try {
      const messageXml = this.buildMailXml("draft", message);
      const result = await this.call("mail", "MailSaveDraftMails", messageXml);
      const id = result.match(/<mail[^>]+key="([^"]+)"/)?.[1];
      return { success: true, providerMessageId: id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "下書き保存に失敗しました" };
    }
  }

  private buildMailXml(mode: "send" | "draft", message: OutgoingMail): string {
    const accountId = escapeXml(message.accountId || this.credentials.accountId);
    const recipients = [
      `to_string="${escapeXml(message.to)}"`,
      message.cc ? `cc_string="${escapeXml(message.cc)}"` : "",
      message.bcc ? `bcc_string="${escapeXml(message.bcc)}"` : "",
    ].filter(Boolean).join(" ");
    const mail = `<mail xmlns="" key="dummy" version="dummy" subject="${escapeXml(message.subject)}" body="${escapeXml(message.body)}" folder_key="dummy"></mail>`;
    if (mode === "draft") {
      return `<save_mail xmlns="" operation="send" account_id="${accountId}" ${recipients}>${mail}</save_mail>`;
    }
    return `<send_mail xmlns="" account_id="${accountId}" ${recipients}>${mail}</send_mail>`;
  }
}
