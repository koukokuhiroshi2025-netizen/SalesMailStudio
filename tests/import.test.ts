import { describe, expect, it } from "vitest";
import { autoMapColumns, validateImportRows } from "../shared/import";

describe("sales list import", () => {
  it("日本語の代表的な列名を自動マッピングする", () => {
    expect(autoMapColumns(["企業名", "担当者名", "担当者メール", "会社の課題"]))
      .toMatchObject({
        company: "企業名",
        name: "担当者名",
        email: "担当者メール",
        issue: "会社の課題",
      });
  });

  it("正常、重複、形式不正、配信停止を分類する", () => {
    const rows = [
      { 会社名: "A社", 氏名: "山田", メール: "a@example.com" },
      { 会社名: "B社", 氏名: "佐藤", メール: "a@example.com" },
      { 会社名: "C社", 氏名: "鈴木", メール: "invalid" },
      { 会社名: "D社", 氏名: "高橋", メール: "stop@example.com" },
    ];
    const result = validateImportRows(
      rows,
      { company: "会社名", name: "氏名", email: "メール" },
      [],
      ["stop@example.com"],
    );
    expect(result.map((row) => row.state)).toEqual(["valid", "blocked", "blocked", "blocked"]);
    expect(result[1]?.reasons).toContain("メールアドレスが重複しています");
    expect(result[3]?.reasons).toContain("配信停止リストに登録されています");
  });

  it("数式として始まる値を文字列化する", () => {
    const [row] = validateImportRows(
      [{ 会社名: "=HYPERLINK(1)", 氏名: "山田", メール: "safe@example.com" }],
      { company: "会社名", name: "氏名", email: "メール" },
    );
    expect(row?.state).toBe("warning");
    expect(row?.contact.company).toBe("'=HYPERLINK(1)");
  });
});
