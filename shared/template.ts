import type { Contact } from "./types";

export const MERGE_FIELDS = [
  { key: "company", label: "会社名" },
  { key: "department", label: "部署" },
  { key: "position", label: "役職" },
  { key: "name", label: "氏名" },
  { key: "email", label: "メールアドレス" },
  { key: "industry", label: "業種" },
  { key: "area", label: "地域" },
  { key: "sales_rep", label: "営業担当" },
  { key: "rank", label: "重要ランク" },
  { key: "issue", label: "課題" },
  { key: "service", label: "提案サービス" },
  { key: "note", label: "備考" },
] as const;

export type MergeField = (typeof MERGE_FIELDS)[number]["key"];
export type MergeData = Partial<Record<MergeField, string | null | undefined>>;

const FIELD_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function extractMergeFields(value: string): string[] {
  return [...new Set(Array.from(value.matchAll(FIELD_PATTERN), (match) => match[1] ?? ""))]
    .filter(Boolean);
}

export function renderTemplate(value: string, data: MergeData) {
  const unresolved = new Set<string>();
  const content = value.replace(FIELD_PATTERN, (token, rawKey: string) => {
    const key = rawKey as MergeField;
    const replacement = data[key];
    if (replacement === null || replacement === undefined || String(replacement).trim() === "") {
      unresolved.add(rawKey);
      return token;
    }
    return String(replacement);
  });
  return { content, unresolved: [...unresolved] };
}

export function contactToMergeData(contact: Contact): MergeData {
  return {
    company: contact.company,
    department: contact.department,
    position: contact.position,
    name: contact.name,
    email: contact.email,
    industry: contact.industry,
    area: contact.area,
    sales_rep: contact.sales_rep,
    rank: contact.rank,
    issue: contact.issue,
    service: contact.service,
    note: contact.note,
  };
}
