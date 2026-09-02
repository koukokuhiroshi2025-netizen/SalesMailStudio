export const CONTACT_FIELDS = [
  { key: "company", label: "企業名", required: true },
  { key: "department", label: "部署", required: false },
  { key: "position", label: "役職", required: false },
  { key: "name", label: "氏名", required: true },
  { key: "email", label: "メールアドレス", required: true },
  { key: "phone", label: "電話番号", required: false },
  { key: "industry", label: "業種", required: false },
  { key: "area", label: "地域", required: false },
  { key: "sales_rep", label: "営業担当", required: false },
  { key: "rank", label: "重要度ランク", required: false },
  { key: "issue", label: "課題", required: false },
  { key: "service", label: "提案サービス", required: false },
  { key: "note", label: "備考", required: false },
] as const;

export type ContactFieldKey = (typeof CONTACT_FIELDS)[number]["key"];
export type ColumnMapping = Partial<Record<ContactFieldKey, string>>;
export type RawRow = Record<string, unknown>;

const ALIASES: Record<ContactFieldKey, string[]> = {
  company: ["企業名", "会社名", "会社", "法人名", "company"],
  department: ["部署", "部門", "department"],
  position: ["役職", "肩書", "position", "title"],
  name: ["氏名", "名前", "担当者名", "担当者", "name"],
  email: ["メールアドレス", "メール", "担当者メール", "email", "e-mail"],
  phone: ["電話番号", "電話", "tel", "phone"],
  industry: ["業種", "industry"],
  area: ["地域", "エリア", "都道府県", "area"],
  sales_rep: ["営業担当", "担当営業", "sales_rep"],
  rank: ["重要度ランク", "ランク", "rank"],
  issue: ["課題", "会社の課題", "issue"],
  service: ["提案サービス", "サービス", "service"],
  note: ["備考", "メモ", "note"],
};

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[\s_＿・-]/g, "");
}

function normalizeCompany(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s　]/g, "");
}

export function autoMapColumns(headers: string[]): ColumnMapping {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));
  return Object.fromEntries(
    CONTACT_FIELDS.map(({ key }) => {
      const aliases = ALIASES[key].map(normalizeHeader);
      const hit = normalizedHeaders.find(({ normalized }) => aliases.includes(normalized));
      return [key, hit?.original];
    }).filter((entry) => entry[1]),
  );
}

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function sanitizeCell(value: unknown) {
  const text = String(value ?? "").replace(/\0/g, "").trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export interface CheckedImportRow {
  rowNumber: number;
  state: "valid" | "warning" | "blocked";
  reasons: string[];
  contact: Record<ContactFieldKey, string>;
}

export function validateImportRows(
  rows: RawRow[],
  mapping: ColumnMapping,
  existingEmails: Iterable<string> = [],
  unsubscribedEmails: Iterable<string> = [],
  existingCompanies: Iterable<string> = [],
  sentEmails: Iterable<string> = [],
): CheckedImportRow[] {
  const existing = new Set(Array.from(existingEmails, normalizeEmail));
  const unsubscribed = new Set(Array.from(unsubscribedEmails, normalizeEmail));
  const companies = new Set(Array.from(existingCompanies, normalizeCompany));
  const previouslySent = new Set(Array.from(sentEmails, normalizeEmail));
  const seen = new Set<string>();
  const seenCompanies = new Set<string>();

  return rows.map((row, index) => {
    const contact = Object.fromEntries(
      CONTACT_FIELDS.map(({ key }) => [key, sanitizeCell(mapping[key] ? row[mapping[key]!] : "")]),
    ) as Record<ContactFieldKey, string>;
    contact.email = normalizeEmail(contact.email);
    const company = normalizeCompany(contact.company);
    const reasons: string[] = [];
    let state: CheckedImportRow["state"] = "valid";

    if (!contact.company || !contact.name || !contact.email) {
      reasons.push("必須項目が不足しています");
      state = "blocked";
    }
    if (contact.email && !EMAIL_PATTERN.test(contact.email)) {
      reasons.push("メールアドレスの形式が不正です");
      state = "blocked";
    }
    if (contact.email && (seen.has(contact.email) || existing.has(contact.email))) {
      reasons.push("メールアドレスが重複しています");
      state = "blocked";
    }
    if (contact.email && unsubscribed.has(contact.email)) {
      reasons.push("配信停止リストに登録されています");
      state = "blocked";
    }
    if (company && (companies.has(company) || seenCompanies.has(company))) {
      reasons.push("同一企業のデータがあります");
      if (state === "valid") state = "warning";
    }
    if (contact.email && previouslySent.has(contact.email)) {
      reasons.push("過去に送信済みです");
      if (state === "valid") state = "warning";
    }
    if (Object.values(contact).some((value) => /^'[=+\-@]/.test(value))) {
      reasons.push("数式として解釈される可能性のある値を文字列化しました");
      if (state === "valid") state = "warning";
    }
    if (contact.email) seen.add(contact.email);
    if (company) seenCompanies.add(company);

    return { rowNumber: index + 2, state, reasons, contact };
  });
}
