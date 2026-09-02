PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'member')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mail_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mock', 'garoon', 'gmail', 'microsoft', 'smtp')),
  display_name TEXT NOT NULL,
  email TEXT,
  account_id TEXT,
  base_url TEXT,
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('connected', 'unverified', 'error', 'disabled')),
  last_tested_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company TEXT NOT NULL,
  department TEXT,
  position TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  industry TEXT,
  area TEXT,
  sales_rep TEXT,
  rank TEXT DEFAULT 'OUT',
  status TEXT NOT NULL DEFAULT '未アプローチ',
  issue TEXT,
  service TEXT,
  note TEXT,
  last_contact_at TEXT,
  next_followup_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, email)
);

CREATE TABLE IF NOT EXISTS custom_fields (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, field_key)
);

CREATE TABLE IF NOT EXISTS contact_custom_values (
  contact_id TEXT NOT NULL,
  custom_field_id TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (contact_id, custom_field_id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (custom_field_id) REFERENCES custom_fields(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  signature TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  template_id TEXT,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('send', 'draft', 'scheduled')),
  status TEXT NOT NULL DEFAULT 'pending',
  target_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  draft_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS campaign_contacts (
  campaign_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  PRIMARY KEY (campaign_id, contact_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mail_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  campaign_id TEXT,
  contact_id TEXT,
  provider TEXT NOT NULL,
  mail_account_id TEXT,
  to_address TEXT NOT NULL,
  cc TEXT,
  bcc TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'drafted', 'failed', 'cancelled')),
  sent_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS unsubscribes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, email)
);

CREATE TABLE IF NOT EXISTS followups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  due_at TEXT NOT NULL,
  content TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  sales_rep TEXT,
  status TEXT NOT NULL,
  expected_close_date TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  next_action TEXT,
  probability INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_company ON contacts(user_id, company);
CREATE INDEX IF NOT EXISTS idx_contacts_user_status ON contacts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_user_followup ON contacts(user_id, next_followup_at);
CREATE INDEX IF NOT EXISTS idx_logs_user_created ON mail_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_campaign ON mail_logs(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_created ON campaigns(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_followups_user_due ON followups(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_unsubscribes_user_email ON unsubscribes(user_id, email);

INSERT OR IGNORE INTO users (id, email, display_name) VALUES
  ('demo-user', 'sales@example.com', '営業企画チーム');

INSERT OR IGNORE INTO mail_accounts
  (id, user_id, provider, display_name, email, account_id, status)
VALUES
  ('account-mock', 'demo-user', 'mock', 'デモ送信アカウント', 'sales@example.com', '1', 'connected');

INSERT OR IGNORE INTO contacts
  (id, user_id, company, department, position, name, email, phone, industry, area, sales_rep, rank, status, issue, service, note, last_contact_at, next_followup_at)
VALUES
  ('contact-1', 'demo-user', '株式会社ノーススター', '経営企画部', '部長', '山田 太郎', 'yamada@example.com', '011-000-0001', '製造業', '北海道', '小泉', 'A', '返信待ち', '業務の属人化', '業務改善AI研修', '8月セミナー参加', '2026-08-28', '2026-09-03'),
  ('contact-2', 'demo-user', '北海フーズ株式会社', '総務部', '課長', '佐藤 花子', 'sato@example.com', '011-000-0002', '食品', '北海道', '小泉', 'B', '初回アプローチ', '若手育成', 'マネジメント研修', '紹介先', NULL, '2026-09-04'),
  ('contact-3', 'demo-user', '石狩テクノ株式会社', 'DX推進室', '室長', '鈴木 一郎', 'suzuki@example.com', '0133-000-0003', 'IT', '北海道', '田中', 'C', 'アポ獲得', '生成AIの定着', '生成AI導入支援', 'オンライン面談予定', '2026-08-30', '2026-09-02'),
  ('contact-4', 'demo-user', '札幌建設サンプル株式会社', '人事部', '主任', '高橋 美咲', 'takahashi@example.com', '011-000-0004', '建設業', '北海道', '田中', 'B', '未アプローチ', '評価制度の運用', '人事制度コンサルティング', '', NULL, '2026-09-08');

INSERT OR IGNORE INTO templates
  (id, user_id, name, purpose, subject, body, signature)
VALUES
  ('template-1', 'demo-user', '業務改善AI研修のご案内', '新規営業', '{{company}}様｜業務改善AI研修のご案内', '{{company}}\n{{department}} {{name}} 様\n\n突然のご連絡失礼いたします。\n{{sales_rep}}と申します。\n\n貴社の{{issue}}というテーマに対し、弊社の「{{service}}」がお役に立てるのではないかと思い、ご連絡しました。\n\nまずは20分ほど、現在のお取り組みを伺う機会をいただけますと幸いです。', '株式会社サンプル\n営業部 {{sales_rep}}'),
  ('template-2', 'demo-user', 'セミナー後フォロー', '既存顧客フォロー', '先日はありがとうございました｜{{company}} {{name}}様', '{{company}}\n{{name}} 様\n\n先日はセミナーへご参加いただき、誠にありがとうございました。\n特に{{issue}}について、追加で参考になる事例をご用意しております。\n\nご関心がございましたら、お気軽にご返信ください。', '株式会社サンプル\n営業部 {{sales_rep}}');

INSERT OR IGNORE INTO followups
  (id, user_id, contact_id, due_at, content)
VALUES
  ('followup-1', 'demo-user', 'contact-1', '2026-09-03', '前回メールへの反応を確認'),
  ('followup-2', 'demo-user', 'contact-3', '2026-09-02', 'オンライン面談の資料を送付');

INSERT OR IGNORE INTO deals
  (id, user_id, contact_id, sales_rep, status, expected_close_date, amount, next_action, probability, note)
VALUES
  ('deal-1', 'demo-user', 'contact-3', '田中', 'ヒアリング', '2026-10-31', 1200000, '課題ヒアリング', 40, 'DX推進室案件');

INSERT OR IGNORE INTO settings (id, user_id, setting_key, value) VALUES
  ('setting-max-batch', 'demo-user', 'max_batch_size', '100'),
  ('setting-interval', 'demo-user', 'send_interval_seconds', '10'),
  ('setting-unsubscribe', 'demo-user', 'append_unsubscribe', 'false');
