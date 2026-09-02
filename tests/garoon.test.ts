import { describe, expect, it } from "vitest";
import { buildSoapEnvelope, escapeXml } from "../worker/providers/garoon";

describe("Garoon SOAP XML", () => {
  it("XML属性と改行を安全にエスケープする", () => {
    expect(escapeXml('A&B <test> "x"\nnext'))
      .toBe("A&amp;B &lt;test&gt; &quot;x&quot;&#10;next");
  });

  it("Action、WS-Security、Timestampを含むSOAP 1.2 Envelopeを作る", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    const xml = buildSoapEnvelope(
      "MailSendMails",
      '<send_mail xmlns="" account_id="1"></send_mail>',
      { username: "sales&user", password: "p<ass" },
      now,
    );
    expect(xml).toContain('xmlns:soap="http://www.w3.org/2003/05/soap-envelope"');
    expect(xml).toContain("<Action>MailSendMails</Action>");
    expect(xml).toContain("<Username>sales&amp;user</Username>");
    expect(xml).toContain("<Password>p&lt;ass</Password>");
    expect(xml).toContain("<Created>2026-09-01T00:00:00.000Z</Created>");
    expect(xml).toContain("<Expires>2026-09-01T00:05:00.000Z</Expires>");
  });
});
