import { z } from "zod";

const optionalText = (max = 500) => z.string().trim().max(max).optional().default("");
const email = z.string().trim().toLowerCase().email().max(254);

export const accessTokenSchema = z.object({
  token: z.string().min(32).max(512),
}).strict();


export const contactInputSchema = z.object({
  company: z.string().trim().min(1).max(200),
  department: optionalText(200),
  position: optionalText(200),
  name: z.string().trim().min(1).max(200),
  email,
  phone: optionalText(100),
  industry: optionalText(100),
  area: optionalText(100),
  sales_rep: optionalText(100),
  rank: z.enum(["A", "B", "C", "D", "OUT"]).optional().default("OUT"),
  status: optionalText(100),
  issue: optionalText(1000),
  service: optionalText(1000),
  note: optionalText(2000),
}).strict();

export const importSchema = z.object({
  contacts: z.array(contactInputSchema).min(1).max(500),
}).strict();

export const templateInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  purpose: z.string().trim().min(1).max(100),
  subject: z.string().trim().min(1).max(500),
  body: z.string().min(1).max(50_000),
  signature: z.string().max(10_000).optional().default(""),
}).strict();

export const bulkStatusSchema = z.object({
  ids: z.array(z.string().min(1).max(100)).min(1).max(100),
  status: z.enum([
    "未アプローチ", "送信予定", "送信済", "返信待ち", "返信あり", "アポ獲得",
    "アポ失注", "再提案", "見積提出", "受注", "失注", "保留", "対象外",
  ]),
}).strict();

export const unsubscribeSchema = z.object({
  email,
  reason: z.enum(["配信停止希望", "送信エラー", "退職", "対象外", "手動登録"]),
  source: z.string().trim().max(100).optional().default("manual"),
}).strict();

export const settingsSchema = z.object({
  max_batch_size: z.number().int().min(1).max(500).optional(),
  send_interval_seconds: z.union([z.literal(5), z.literal(10), z.literal(30), z.literal(60)]).optional(),
  append_unsubscribe: z.boolean().optional(),
}).strict();

export const garoonTestSchema = z.object({
  baseUrl: z.string().url().max(500),
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
  accountId: z.string().min(1).max(100),
  basicUsername: z.string().max(200).optional(),
  basicPassword: z.string().max(500).optional(),
}).strict();

export const testMailSchema = z.object({
  to: email,
  subject: z.string().trim().min(1).max(500),
  body: z.string().min(1).max(50_000),
}).strict();

export const campaignSchema = z.object({
  name: z.string().trim().min(1).max(200),
  templateId: z.string().max(100).optional(),
  contactIds: z.array(z.string().min(1).max(100)).min(1).max(500),
  subject: z.string().trim().min(1).max(500),
  body: z.string().min(1).max(50_000),
  cc: z.string().max(1000).optional().default(""),
  bcc: z.string().max(1000).optional().default(""),
  mode: z.enum(["send", "draft"]),
  intervalSeconds: z.union([z.literal(5), z.literal(10), z.literal(30), z.literal(60)]),
  confirmedCount: z.number().int().min(0),
}).strict();

export const mailAccountMetadataSchema = z.object({
  baseUrl: z.string().url().max(500),
  accountId: z.string().min(1).max(100),
  displayName: z.string().trim().min(1).max(200),
  email: z.union([email, z.literal("")]).optional().default(""),
}).strict();
