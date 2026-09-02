import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { gridToRows, parseCsvText, parseImportFile } from "../src/lib/parse-import-file";

describe("CSV / Excel import parsing", () => {
  it("quoted commas, escaped quotes, and embedded newlines are preserved", () => {
    expect(parseCsvText('会社名,備考\r\n"北海,商事","担当者は""山田""\n次回連絡"')).toEqual([
      ["会社名", "備考"],
      ["北海,商事", '担当者は"山田"\n次回連絡'],
    ]);
  });

  it("turns the first row into object keys and ignores empty rows", () => {
    expect(gridToRows([["会社名", "メール"], ["サンプル株式会社", "sales@example.com"], [null, null]])).toEqual({
      headers: ["会社名", "メール"],
      rows: [{ 会社名: "サンプル株式会社", メール: "sales@example.com" }],
    });
  });

  it.each(["xlsx", "xls"] as const)("reads a browser %s workbook", async (extension) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["企業名", "氏名", "メールアドレス"],
      ["架空産業株式会社", "検証 太郎", "verify@example.com"],
    ]), "営業リスト");
    const bytes = XLSX.write(workbook, { type: "array", bookType: extension });
    const file = new File([bytes], `sample.${extension}`);

    await expect(parseImportFile(file)).resolves.toEqual({
      headers: ["企業名", "氏名", "メールアドレス"],
      rows: [{ 企業名: "架空産業株式会社", 氏名: "検証 太郎", メールアドレス: "verify@example.com" }],
    });
  });
});
