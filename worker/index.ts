import { contactToMergeData, renderTemplate } from "../shared/template";
import type {
  Campaign,
  Contact,
  Deal,
  Followup,
  MailAccount,
  MailLog,
  MailTemplate,
  Unsubscribe,
} from "../shared/types";
import {
  authenticateCredentials,
  clearSessionCookie,
  createSessionCookie,
  getSession,
  type SessionUser,
} from "./auth";
import { apiError, assertSameOrigin, json, readJson } from "./http";
import { createMailProvider } from "./providers";
import { enforceMutationRateLimit } from "./rate-limit";
import type { GaroonCredentials, OutgoingMail } from "./providers/types";
import {
  bulkStatusSchema,
  campaignSchema,
  contactInputSchema,
  garoonTestSchema,
  importSchema,
  loginSchema,
  mailAccountMetadataSchema,
  settingsSchema,
  templateInputSchema,
  testMailSchema,
  unsubscribeSchema,
} from "./schemas";

interface MailQueueJob {
  logId: string;
  campaignId: string;
  contactId: string;
  mode: "send" | "draft";
  message: OutgoingMail;
}

function nullable(value: string) {
  return value || null;
}

function chunks<T>(items: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

async function all<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results;
}

async function ensureUser(env: Env, user: SessionUser) {
  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, updated_at = datetime('now')`,
  ).bind(user.id, user.email, user.displayName).run();
}

async function bootstrap(env: Env, user: SessionUser) {
  const userId = user.id;
  const [
    contacts,
    templates,
    logs,
    campaigns,
    followups,
    deals,
    unsubscribes,
    mailAccounts,
    settingRows,
  ] = await Promise.all([
    all<Contact>(env.DB.prepare("SELECT * FROM contacts WHERE user_id = ? ORDER BY updated_at DESC").bind(userId)),
    all<MailTemplate>(env.DB.prepare("SELECT * FROM templates WHERE user_id = ? ORDER BY updated_at DESC").bind(userId)),
    all<MailLog>(env.DB.prepare(
      `SELECT l.*, c.company, c.name AS contact_name
       FROM mail_logs l LEFT JOIN contacts c ON c.id = l.contact_id
       WHERE l.user_id = ? ORDER BY l.created_at DESC LIMIT 100`,
    ).bind(userId)),
    all<Campaign>(env.DB.prepare("SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId)),
    all<Followup>(env.DB.prepare(
      `SELECT f.*, c.company, c.name, c.status, c.last_contact_at
       FROM followups f JOIN contacts c ON c.id = f.contact_id
       WHERE f.user_id = ? AND f.completed_at IS NULL ORDER BY f.due_at ASC`,
    ).bind(userId)),
    all<Deal>(env.DB.prepare(
      `SELECT d.*, c.company, c.name
       FROM deals d JOIN contacts c ON c.id = d.contact_id
       WHERE d.user_id = ? ORDER BY d.updated_at DESC`,
    ).bind(userId)),
    all<Unsubscribe>(env.DB.prepare("SELECT * FROM unsubscribes WHERE user_id = ? ORDER BY created_at DESC").bind(userId)),
    all<MailAccount>(env.DB.prepare("SELECT * FROM mail_accounts WHERE user_id = ? ORDER BY created_at ASC").bind(userId)),
    all<{ setting_key: string; value: string }>(
      env.DB.prepare("SELECT setting_key, value FROM settings WHERE user_id = ?").bind(userId),
    ),
  ]);

  const settings = Object.fromEntries(settingRows.map((row) => [row.setting_key, row.value]));
  const statusCount = (value: string) => contacts.filter((contact) => contact.status === value).length;
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  return {
    user: { id: user.id, email: user.email, displayName: user.displayName },
    contacts,
    templates,
    logs,
    campaigns,
    followups,
    deals,
    unsubscribes,
    mailAccounts,
    settings,
    provider: env.MAIL_PROVIDER,
    stats: {
      contacts: contacts.length,
      sentThisMonth: logs.filter((log) => log.status === "sent" && new Date(log.created_at) >= startOfMonth).length,
      replies: statusCount("返信あり"),
      appointments: statusCount("アポ獲得"),
      won: deals.filter((deal) => deal.status === "受注").length,
      lost: deals.filter((deal) => deal.status === "失注").length,
      today: {
        "初回アプローチ": statusCount("未アプローチ"),
        "本日フォロー": followups.filter((item) => item.due_at <= new Date().toISOString().slice(0, 10)).length,
        "返信待ち": statusCount("返信待ち"),
        "アポ獲得": statusCount("アポ獲得"),
        "再提案": statusCount("再提案"),
      },
    },
  };
}

async function importContacts(request: Request, env: Env, user: SessionUser) {
  const parsed = importSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("取込データを確認してください", 422, parsed.error.issues);
  const [existingRows, blockedRows] = await Promise.all([
    all<{ email: string }>(env.DB.prepare("SELECT email FROM contacts WHERE user_id = ?").bind(user.id)),
    all<{ email: string }>(env.DB.prepare("SELECT email FROM unsubscribes WHERE user_id = ?").bind(user.id)),
  ]);
  const existing = new Set(existingRows.map((row) => row.email.toLowerCase()));
  const blocked = new Set(blockedRows.map((row) => row.email.toLowerCase()));
  const seen = new Set<string>();
  const statements: D1PreparedStatement[] = [];
  const skipped: Array<{ email: string; reason: string }> = [];

  for (const contact of parsed.data.contacts) {
    if (existing.has(contact.email) || seen.has(contact.email)) {
      skipped.push({ email: contact.email, reason: "重複" });
      continue;
    }
    if (blocked.has(contact.email)) {
      skipped.push({ email: contact.email, reason: "配信停止" });
      continue;
    }
    seen.add(contact.email);
    statements.push(env.DB.prepare(
      `INSERT INTO contacts (
        id, user_id, company, department, position, name, email, phone, industry, area,
        sales_rep, rank, status, issue, service, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), user.id, contact.company, nullable(contact.department), nullable(contact.position),
      contact.name, contact.email, nullable(contact.phone), nullable(contact.industry), nullable(contact.area),
      nullable(contact.sales_rep), contact.rank, contact.status || "未アプローチ", nullable(contact.issue),
      nullable(contact.service), nullable(contact.note),
    ));
  }
  for (const group of chunks(statements, 50)) await env.DB.batch(group);
  return json({ imported: statements.length, skipped, total: parsed.data.contacts.length }, { status: 201 });
}

async function createCampaign(request: Request, env: Env, user: SessionUser) {
  const parsed = campaignSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("配信内容を確認してください", 422, parsed.error.issues);
  const input = parsed.data;
  const placeholders = input.contactIds.map(() => "?").join(",");
  const contacts = await all<Contact>(env.DB.prepare(
    `SELECT * FROM contacts WHERE user_id = ? AND id IN (${placeholders})`,
  ).bind(user.id, ...input.contactIds));
  const blockedRows = await all<{ email: string }>(
    env.DB.prepare("SELECT email FROM unsubscribes WHERE user_id = ?").bind(user.id),
  );
  const blocked = new Set(blockedRows.map((row) => row.email.toLowerCase()));
  const eligible: Array<{ contact: Contact; subject: string; body: string }> = [];
  const skipped: Array<{ contactId: string; reason: string }> = [];

  for (const contact of contacts) {
    if (blocked.has(contact.email.toLowerCase())) {
      skipped.push({ contactId: contact.id, reason: "配信停止リスト" });
      continue;
    }
    const data = contactToMergeData(contact);
    const subject = renderTemplate(input.subject, data);
    const body = renderTemplate(input.body, data);
    const unresolved = [...new Set([...subject.unresolved, ...body.unresolved])];
    if (unresolved.length) {
      skipped.push({ contactId: contact.id, reason: `未展開: ${unresolved.join(", ")}` });
      continue;
    }
    eligible.push({ contact, subject: subject.content, body: body.content });
  }

  if (!eligible.length) return apiError("送信可能な対象がありません", 422, skipped);
  if (input.confirmedCount !== eligible.length) {
    return apiError("確認した送信件数と実際の件数が一致しません。プレビューをやり直してください", 409);
  }
  const maxRow = await env.DB.prepare(
    "SELECT value FROM settings WHERE user_id = ? AND setting_key = 'max_batch_size'",
  ).bind(user.id).first<{ value: string }>();
  const maxBatch = Math.min(500, Number(maxRow?.value ?? 100));
  if (eligible.length > maxBatch) return apiError(`一度に処理できる上限は${maxBatch}件です`, 422);

  const campaignId = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO campaigns (
      id, user_id, name, template_id, provider, mode, status, target_count, created_at, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?)`,
  ).bind(
    campaignId, user.id, input.name, input.templateId || null, env.MAIL_PROVIDER,
    input.mode, eligible.length, now, now,
  ).run();

  const jobs: Array<{ job: MailQueueJob; delaySeconds: number }> = [];
  const insertStatements: D1PreparedStatement[] = [];
  eligible.forEach(({ contact, subject, body }, index) => {
    const logId = crypto.randomUUID();
    insertStatements.push(
      env.DB.prepare(
        "INSERT INTO campaign_contacts (campaign_id, contact_id, status) VALUES (?, ?, 'pending')",
      ).bind(campaignId, contact.id),
      env.DB.prepare(
        `INSERT INTO mail_logs (
          id, user_id, campaign_id, contact_id, provider, to_address, cc, bcc, subject, body, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      ).bind(
        logId, user.id, campaignId, contact.id, env.MAIL_PROVIDER, contact.email,
        nullable(input.cc), nullable(input.bcc), subject, body,
      ),
    );
    jobs.push({
      job: {
        logId,
        campaignId,
        contactId: contact.id,
        mode: input.mode,
        message: { to: contact.email, cc: input.cc, bcc: input.bcc, subject, body },
      },
      delaySeconds: index * input.intervalSeconds,
    });
  });
  for (const group of chunks(insertStatements, 50)) await env.DB.batch(group);

  let queued = 0;
  for (const { job, delaySeconds } of jobs) {
    try {
      await env.MAIL_QUEUE.send(job, { delaySeconds: Math.min(delaySeconds, 43_200) });
      queued += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "キュー登録に失敗しました";
      await env.DB.batch([
        env.DB.prepare("UPDATE mail_logs SET status = 'failed', error_message = ? WHERE id = ?").bind(message, job.logId),
        env.DB.prepare("UPDATE campaign_contacts SET status = 'failed' WHERE campaign_id = ? AND contact_id = ?").bind(campaignId, job.contactId),
      ]);
    }
  }
  return json({ campaignId, queued, skipped, targetCount: eligible.length }, { status: 202 });
}

async function refreshCampaign(env: Env, campaignId: string) {
  const counts = await all<{ status: string; count: number }>(
    env.DB.prepare("SELECT status, COUNT(*) AS count FROM mail_logs WHERE campaign_id = ? GROUP BY status").bind(campaignId),
  );
  const byStatus = Object.fromEntries(counts.map((row) => [row.status, Number(row.count)]));
  const campaign = await env.DB.prepare("SELECT target_count FROM campaigns WHERE id = ?").bind(campaignId).first<{ target_count: number }>();
  const finished = (byStatus.sent ?? 0) + (byStatus.drafted ?? 0) + (byStatus.failed ?? 0) + (byStatus.cancelled ?? 0);
  await env.DB.prepare(
    `UPDATE campaigns SET sent_count = ?, draft_count = ?, failed_count = ?,
      status = ?, completed_at = ? WHERE id = ?`,
  ).bind(
    byStatus.sent ?? 0,
    byStatus.drafted ?? 0,
    byStatus.failed ?? 0,
    campaign && finished >= campaign.target_count ? "completed" : "processing",
    campaign && finished >= campaign.target_count ? new Date().toISOString() : null,
    campaignId,
  ).run();
}

async function processMailJob(job: MailQueueJob, env: Env) {
  await env.DB.prepare("UPDATE mail_logs SET status = 'processing' WHERE id = ? AND status = 'pending'").bind(job.logId).run();
  const provider = createMailProvider(env);
  const result = job.mode === "draft" && provider.saveDraft
    ? await provider.saveDraft(job.message)
    : await provider.sendMail(job.message);
  const status = result.success ? (job.mode === "draft" ? "drafted" : "sent") : "failed";
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE mail_logs SET status = ?, sent_at = ?, error_message = ? WHERE id = ?",
    ).bind(status, result.success ? new Date().toISOString() : null, result.error ?? null, job.logId),
    env.DB.prepare(
      "UPDATE campaign_contacts SET status = ? WHERE campaign_id = ? AND contact_id = ?",
    ).bind(status, job.campaignId, job.contactId),
    ...(result.success && job.mode === "send"
      ? [env.DB.prepare(
        "UPDATE contacts SET status = '送信済', last_contact_at = ?, updated_at = datetime('now') WHERE id = ?",
      ).bind(new Date().toISOString(), job.contactId)]
      : []),
  ]);
  await refreshCampaign(env, job.campaignId);
  console.log(JSON.stringify({
    event: "mail_job_completed",
    logId: job.logId,
    campaignId: job.campaignId,
    status,
  }));
}

async function routeApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  const rateLimited = await enforceMutationRateLimit(request, env);
  if (rateLimited) return rateLimited;
  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true, environment: env.ENVIRONMENT, provider: env.MAIL_PROVIDER });
  }
  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    assertSameOrigin(request);
    const parsed = loginSchema.safeParse(await readJson(request, 10_000));
    if (!parsed.success) return apiError("メールアドレスとパスワードを確認してください", 422);
    const user = await authenticateCredentials(parsed.data.email, parsed.data.password, env);
    if (!user) return apiError("メールアドレスまたはパスワードが違います", 401);
    await ensureUser(env, user);
    return json(
      { user: { id: user.id, email: user.email, displayName: user.displayName } },
      { headers: { "Set-Cookie": await createSessionCookie(user, env) } },
    );
  }
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    assertSameOrigin(request);
    return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(env) } });
  }

  const user = await getSession(request, env);
  if (!user) return apiError("ログインが必要です", 401);
  if (!["GET", "HEAD"].includes(request.method)) assertSameOrigin(request);

  if (url.pathname === "/api/bootstrap" && request.method === "GET") {
    return json(await bootstrap(env, user));
  }
  if (url.pathname === "/api/contacts/import" && request.method === "POST") {
    return importContacts(request, env, user);
  }
  if (url.pathname === "/api/contacts" && request.method === "POST") {
    const parsed = contactInputSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("顧客情報を確認してください", 422, parsed.error.issues);
    const contact = parsed.data;
    const id = crypto.randomUUID();
    try {
      await env.DB.prepare(
        `INSERT INTO contacts (
          id, user_id, company, department, position, name, email, phone, industry, area,
          sales_rep, rank, status, issue, service, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        id, user.id, contact.company, nullable(contact.department), nullable(contact.position), contact.name,
        contact.email, nullable(contact.phone), nullable(contact.industry), nullable(contact.area),
        nullable(contact.sales_rep), contact.rank, contact.status || "未アプローチ", nullable(contact.issue),
        nullable(contact.service), nullable(contact.note),
      ).run();
      return json({ id }, { status: 201 });
    } catch {
      return apiError("同じメールアドレスの顧客が登録されています", 409);
    }
  }
  if (url.pathname === "/api/contacts/bulk-status" && request.method === "PATCH") {
    const parsed = bulkStatusSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("ステータス変更内容を確認してください", 422);
    const statements = parsed.data.ids.map((id) => env.DB.prepare(
      "UPDATE contacts SET status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
    ).bind(parsed.data.status, id, user.id));
    for (const group of chunks(statements, 50)) await env.DB.batch(group);
    return json({ updated: statements.length });
  }
  const contactMatch = url.pathname.match(/^\/api\/contacts\/([^/]+)$/);
  if (contactMatch && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM contacts WHERE id = ? AND user_id = ?").bind(contactMatch[1], user.id).run();
    return json({ ok: true });
  }
  if (url.pathname === "/api/templates" && request.method === "POST") {
    const parsed = templateInputSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("テンプレート内容を確認してください", 422, parsed.error.issues);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO templates (id, user_id, name, purpose, subject, body, signature) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, user.id, parsed.data.name, parsed.data.purpose, parsed.data.subject, parsed.data.body, nullable(parsed.data.signature)).run();
    return json({ id }, { status: 201 });
  }
  const templateMatch = url.pathname.match(/^\/api\/templates\/([^/]+)$/);
  if (templateMatch && request.method === "PUT") {
    const parsed = templateInputSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("テンプレート内容を確認してください", 422, parsed.error.issues);
    await env.DB.prepare(
      `UPDATE templates SET name = ?, purpose = ?, subject = ?, body = ?, signature = ?,
       updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
    ).bind(
      parsed.data.name, parsed.data.purpose, parsed.data.subject, parsed.data.body,
      nullable(parsed.data.signature), templateMatch[1], user.id,
    ).run();
    return json({ ok: true });
  }
  if (url.pathname === "/api/unsubscribes" && request.method === "POST") {
    const parsed = unsubscribeSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("配信停止情報を確認してください", 422);
    await env.DB.prepare(
      `INSERT INTO unsubscribes (id, user_id, email, reason, source, created_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, email) DO UPDATE SET reason = excluded.reason, source = excluded.source`,
    ).bind(crypto.randomUUID(), user.id, parsed.data.email, parsed.data.reason, parsed.data.source, user.email).run();
    return json({ ok: true }, { status: 201 });
  }
  const unsubscribeMatch = url.pathname.match(/^\/api\/unsubscribes\/([^/]+)$/);
  if (unsubscribeMatch && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM unsubscribes WHERE id = ? AND user_id = ?").bind(unsubscribeMatch[1], user.id).run();
    return json({ ok: true });
  }
  if (url.pathname === "/api/settings" && request.method === "PATCH") {
    const parsed = settingsSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("設定値を確認してください", 422);
    const values = Object.entries(parsed.data);
    const statements = values.map(([key, value]) => env.DB.prepare(
      `INSERT INTO settings (id, user_id, setting_key, value) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, setting_key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    ).bind(crypto.randomUUID(), user.id, key, String(value)));
    if (statements.length) await env.DB.batch(statements);
    return json({ ok: true });
  }
  if (url.pathname === "/api/mail-accounts" && request.method === "POST") {
    const parsed = mailAccountMetadataSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("メールアカウント設定を確認してください", 422);
    await env.DB.prepare(
      `INSERT INTO mail_accounts (id, user_id, provider, display_name, email, account_id, base_url, status)
       VALUES ('account-garoon', ?, 'garoon', ?, ?, ?, ?, 'unverified')
       ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, email = excluded.email,
       account_id = excluded.account_id, base_url = excluded.base_url, updated_at = datetime('now')`,
    ).bind(
      user.id, parsed.data.displayName, nullable(parsed.data.email), parsed.data.accountId, parsed.data.baseUrl,
    ).run();
    return json({ ok: true });
  }
  if (url.pathname === "/api/mail/test-connection" && request.method === "POST") {
    const parsed = garoonTestSchema.safeParse(await readJson(request, 50_000));
    if (!parsed.success) return apiError("Garoon接続情報を確認してください", 422);
    const provider = createMailProvider(env, parsed.data as GaroonCredentials);
    const result = await provider.testConnection();
    await env.DB.prepare(
      "UPDATE mail_accounts SET status = ?, last_tested_at = ?, updated_at = datetime('now') WHERE id = 'account-garoon' AND user_id = ?",
    ).bind(result.success ? "connected" : "error", new Date().toISOString(), user.id).run();
    return json(result, { status: result.success ? 200 : 502 });
  }
  if (url.pathname === "/api/mail/test-send" && request.method === "POST") {
    const parsed = testMailSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("テストメールの内容を確認してください", 422);
    const provider = createMailProvider(env);
    const result = await provider.sendMail({
      to: parsed.data.to,
      subject: parsed.data.subject.startsWith("[TEST]") ? parsed.data.subject : `[TEST] ${parsed.data.subject}`,
      body: parsed.data.body,
    });
    await env.DB.prepare(
      `INSERT INTO mail_logs (
        id, user_id, provider, to_address, subject, body, status, sent_at, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), user.id, env.MAIL_PROVIDER, parsed.data.to,
      parsed.data.subject, parsed.data.body, result.success ? "sent" : "failed",
      result.success ? new Date().toISOString() : null, result.error ?? null,
    ).run();
    return json(result, { status: result.success ? 200 : 502 });
  }
  if (url.pathname === "/api/campaigns" && request.method === "POST") {
    return createCampaign(request, env, user);
  }
  const followupMatch = url.pathname.match(/^\/api\/followups\/([^/]+)\/complete$/);
  if (followupMatch && request.method === "PATCH") {
    await env.DB.prepare(
      "UPDATE followups SET completed_at = datetime('now') WHERE id = ? AND user_id = ?",
    ).bind(followupMatch[1], user.id).run();
    return json({ ok: true });
  }
  return apiError("APIが見つかりません", 404);
}

export default {
  async fetch(request, env): Promise<Response> {
    try {
      return await routeApi(request, env);
    } catch (error) {
      console.error(JSON.stringify({
        event: "api_error",
        path: new URL(request.url).pathname,
        message: error instanceof Error ? error.message : "unknown",
      }));
      return apiError(
        env.ENVIRONMENT === "production" ? "処理に失敗しました" : (error instanceof Error ? error.message : "処理に失敗しました"),
        500,
      );
    }
  },

  async queue(batch, env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processMailJob(message.body as MailQueueJob, env);
        message.ack();
      } catch (error) {
        const job = message.body as MailQueueJob;
        const detail = error instanceof Error ? error.message : "キュー処理に失敗しました";
        await env.DB.prepare(
          "UPDATE mail_logs SET status = 'failed', error_message = ? WHERE id = ?",
        ).bind(detail, job.logId).run();
        await refreshCampaign(env, job.campaignId);
        console.error(JSON.stringify({ event: "mail_job_error", logId: job.logId, message: detail }));
        // Duplicate mail is worse than a missed automatic retry. Fail closed and allow a reviewed manual retry.
        message.ack();
      }
    }
  },
} satisfies ExportedHandler<Env, MailQueueJob>;
