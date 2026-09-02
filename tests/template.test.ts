import { describe, expect, it } from "vitest";
import { extractMergeFields, renderTemplate } from "../shared/template";

describe("template merge", () => {
  it("差し込み項目を顧客データで置換する", () => {
    const result = renderTemplate("{{company}}\n{{name}} 様", {
      company: "株式会社サンプル",
      name: "山田 太郎",
    });
    expect(result.content).toBe("株式会社サンプル\n山田 太郎 様");
    expect(result.unresolved).toEqual([]);
  });

  it("空の値はトークンを残して警告対象にする", () => {
    const result = renderTemplate("課題: {{issue}} / {{service}}", {
      issue: "",
      service: "AI研修",
    });
    expect(result.content).toContain("{{issue}}");
    expect(result.unresolved).toEqual(["issue"]);
  });

  it("利用中の変数を重複なく抽出する", () => {
    expect(extractMergeFields("{{company}} {{ name }} {{company}}"))
      .toEqual(["company", "name"]);
  });
});
