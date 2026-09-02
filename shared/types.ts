export type ContactStatus =
  | "未アプローチ"
  | "送信予定"
  | "送信済"
  | "返信待ち"
  | "返信あり"
  | "アポ獲得"
  | "アポ失注"
  | "再提案"
  | "見積提出"
  | "受注"
  | "失注"
  | "保留"
  | "対象外";

export interface Contact {
  id: string;
  company: string;
  department: string | null;
  position: string | null;
  name: string;
  email: string;
  phone: string | null;
  industry: string | null;
  area: string | null;
  sales_rep: string | null;
  rank: string | null;
  status: ContactStatus | string;
  issue: string | null;
  service: string | null;
  note: string | null;
  last_contact_at: string | null;
  next_followup_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MailTemplate {
  id: string;
  name: string;
  purpose: string;
  subject: string;
  body: string;
  signature: string | null;
  created_at: string;
  updated_at: string;
}

export interface MailLog {
  id: string;
  campaign_id: string | null;
  contact_id: string | null;
  company?: string | null;
  contact_name?: string | null;
  provider: string;
  to_address: string;
  subject: string;
  status: "pending" | "processing" | "sent" | "drafted" | "failed" | "cancelled";
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  provider: string;
  mode: "send" | "draft" | "scheduled";
  status: string;
  target_count: number;
  sent_count: number;
  failed_count: number;
  draft_count: number;
  created_at: string;
}

export interface Followup {
  id: string;
  contact_id: string;
  company: string;
  name: string;
  status: string;
  due_at: string;
  content: string | null;
  last_contact_at: string | null;
}

export interface Deal {
  id: string;
  contact_id: string;
  company: string;
  name: string;
  sales_rep: string | null;
  status: string;
  expected_close_date: string | null;
  amount: number;
  next_action: string | null;
  probability: number;
  note: string | null;
}

export interface Unsubscribe {
  id: string;
  email: string;
  reason: string;
  source: string;
  created_at: string;
  created_by: string;
}

export interface MailAccount {
  id: string;
  provider: string;
  display_name: string;
  email: string | null;
  account_id: string | null;
  base_url: string | null;
  status: string;
  last_tested_at: string | null;
}

export interface DashboardStats {
  contacts: number;
  sentThisMonth: number;
  replies: number;
  appointments: number;
  won: number;
  lost: number;
  today: Record<string, number>;
}

export interface BootstrapData {
  user: { id: string; email: string; displayName: string };
  contacts: Contact[];
  templates: MailTemplate[];
  logs: MailLog[];
  campaigns: Campaign[];
  followups: Followup[];
  deals: Deal[];
  unsubscribes: Unsubscribe[];
  mailAccounts: MailAccount[];
  settings: Record<string, string>;
  stats: DashboardStats;
  provider: string;
}

export interface ApiErrorPayload {
  error: string;
  details?: unknown;
}
