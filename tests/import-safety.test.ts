import { describe, expect, it } from "vitest";
import { validateImportRows } from "../shared/import";

const mapping = {
  company: "会社",
  name: "氏名",
  email: "メール",
} as const;

describe("additional import safety checks", () => {
  it("warns for an existing company and a previously contacted address", () => {
    const [checked] = validateImportRows(
      [{ 会社: "架空産業株式会社", 氏名: "検証 太郎", メール: "sent@example.com" }],
      mapping,
      [],
      [],
      ["架空産業株式会社"],
      ["SENT@example.com"],
    );
    expect(checked.state).toBe("warning");
    expect(checked.reasons).toEqual(expect.arrayContaining([
      "同一企業のデータがあります",
      "過去に送信済みです",
    ]));
  });

  it("neutralizes spreadsheet formulas before import", () => {
    const [checked] = validateImportRows(
      [{ 会社: "=HYPERLINK(\"https://invalid.example\")", 氏名: "検証 太郎", メール: "safe@example.com" }],
      mapping,
    );
    expect(checked.state).toBe("warning");
    expect(checked.contact.company.startsWith("'=")).toBe(true);
  });
});
