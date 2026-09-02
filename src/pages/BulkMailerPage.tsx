import {
  CheckCircle2,
  FileSpreadsheet,
  FlaskConical,
  MailCheck,
  Search,
  Send,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MERGE_FIELDS, contactToMergeData, renderTemplate } from "../../shared/template";
import { useAppData } from "../AppData";
import { postJson } from "../api";
import { ImportDialog } from "../components/ImportDialog";
import {
  Badge,
  Button,
  Card,
  Field,
  Modal,
  Notice,
  PageHeader,
  inputClass,
  statusTone,
  textareaClass,
} from "../components/ui";
import { formatDate } from "../format";

const MAX_BATCH_SIZE = 500;

export function BulkMailerPage() {
  const { data, refresh, selectedContactIds, setSelectedContactIds } = useAppData();
  const [importOpen, setImportOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [interval, setInterval] = useState<5 | 10 | 30 | 60>(10);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [testRecipient, setTestRecipient] = useState(data?.user.email ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastContactKey = useRef("");

  const blockedEmails = useMemo(
    () => new Set(data?.unsubscribes.map((item) => item.email.toLowerCase()) ?? []),
    [data],
  );
  const contactKey = data?.contacts.map((contact) => contact.id).join("|") ?? "";

  useEffect(() => {
    if (!data || !contactKey || lastContactKey.current === contactKey) return;
    lastContactKey.current = contactKey;
    setSelectedContactIds(new Set(
      data.contacts
        .filter((contact) => !blockedEmails.has(contact.email.toLowerCase()))
        .slice(0, MAX_BATCH_SIZE)
        .map((contact) => contact.id),
    ));
  }, [blockedEmails, contactKey, data, setSelectedContactIds]);

  useEffect(() => {
    if (data?.user.email && !testRecipient) setTestRecipient(data.user.email);
  }, [data?.user.email, testRecipient]);

  const filteredContacts = (data?.contacts ?? []).filter((contact) =>
    [contact.company, contact.name, contact.email]
      .some((value) => value.toLowerCase().includes(query.toLowerCase())),
  );
  const selectedContacts = (data?.contacts ?? []).filter((contact) => selectedContactIds.has(contact.id));
  const prepared = selectedContacts.map((contact) => {
    const merge = contactToMergeData(contact);
    const renderedSubject = renderTemplate(subject, merge);
    const renderedBody = renderTemplate(body, merge);
    return {
      contact,
      subject: renderedSubject.content,
      body: renderedBody.content,
      unresolved: [...new Set([...renderedSubject.unresolved, ...renderedBody.unresolved])],
      blocked: blockedEmails.has(contact.email.toLowerCase()),
    };
  });
  const eligible = prepared.filter((mail) => !mail.blocked && mail.unresolved.length === 0);
  const firstPreview = eligible[0] ?? prepared[0];
  const estimatedMinutes = eligible.length > 1 ? Math.ceil(((eligible.length - 1) * interval) / 60) : 0;

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    const template = data?.templates.find((item) => item.id === id);
    if (!template) return;
    setSubject(template.subject);
    setBody(template.body + (template.signature ? "\n\n" + template.signature : ""));
  };

  const toggleContact = (id: string) => {
    const next = new Set(selectedContactIds);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_BATCH_SIZE) next.add(id);
    else return setMessage("1回に選択できる上限は500件です。");
    setSelectedContactIds(next);
  };

  const selectVisible = () => {
    setSelectedContactIds(new Set(
      filteredContacts
        .filter((contact) => !blockedEmails.has(contact.email.toLowerCase()))
        .slice(0, MAX_BATCH_SIZE)
        .map((contact) => contact.id),
    ));
  };

  const insertVariable = (key: string) => {
    const token = "{{" + key + "}}";
    const target = bodyRef.current;
    if (!target) return setBody((value) => value + token);
    const start = target.selectionStart;
    const end = target.selectionEnd;
    setBody((value) => value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const executeCampaign = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await postJson<{ queued: number }>("/api/campaigns", {
        name: new Date().toLocaleDateString("ja-JP") + " 一括メール送信",
        templateId: templateId || undefined,
        contactIds: selectedContacts.map((contact) => contact.id),
        subject,
        body,
        cc: "",
        bcc: "",
        mode: "send",
        intervalSeconds: interval,
        confirmedCount: eligible.length,
      });
      setConfirmOpen(false);
      setMessage(result.queued + "件を送信キューへ登録しました。");
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "一括送信を開始できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const testSend = async () => {
    if (!firstPreview || !testRecipient) return;
    setBusy(true);
    try {
      await postJson("/api/mail/test-send", {
        to: testRecipient,
        subject: firstPreview.subject,
        body: firstPreview.body,
      });
      setMessage(
        data?.provider === "mock"
          ? "テスト処理が完了しました。モックモードのため実メールは送信されません。"
          : testRecipient + "へテスト送信しました。",
      );
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "テスト送信に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const ready = eligible.length > 0 && Boolean(subject.trim()) && Boolean(body.trim());
  const successMessage = message.includes("登録しました") || message.includes("完了しました") || message.includes("テスト送信しました");

  return (
    <>
      <PageHeader
        title="一括メール送信"
        description="リストを読み込み、メールを作成し、宛先ごとに1通ずつ送信します。"
        action={(
          <div className="flex flex-wrap gap-2">
            <a
              href="/sample-sales-list.csv"
              download
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              サンプルCSV
            </a>
            <Button onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="size-4" />
              リストを読み込む
            </Button>
          </div>
        )}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ["1", "リストを読み込む", "Excel / CSV"],
          ["2", "メールを作る", "件名・本文"],
          ["3", "確認して送る", "最大500件"],
        ].map(([number, title, detail]) => (
          <div key={number} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="grid size-9 place-items-center rounded-full bg-blue-700 text-sm font-bold text-white">{number}</span>
            <div><div className="font-bold">{title}</div><div className="text-xs text-slate-500">{detail}</div></div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        {data?.provider === "mock" ? (
          <Notice tone="warning"><strong>現在はテストモードです。</strong> 実メールは送信されません。Garoon設定後に実送信へ切り替わります。</Notice>
        ) : (
          <Notice tone="success"><strong>Garoon実送信モードです。</strong> 配信停止と差し込み内容を再確認してからQueueへ登録します。</Notice>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[370px_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><Users className="size-5 text-blue-700" /><h2 className="font-bold">宛先リスト</h2></div>
                <p className="mt-1 text-xs text-slate-500">{selectedContactIds.size}件を選択中</p>
              </div>
              <div className="flex gap-2 text-xs font-semibold">
                <button type="button" onClick={selectVisible} className="text-blue-700">全件選択</button>
                <button type="button" onClick={() => setSelectedContactIds(new Set())} className="text-slate-500">解除</button>
              </div>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input className={inputClass + " pl-9"} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="会社名・氏名・メール" />
            </div>
          </div>
          {filteredContacts.length ? (
            <div className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto">
              {filteredContacts.map((contact) => {
                const blocked = blockedEmails.has(contact.email.toLowerCase());
                return (
                  <label key={contact.id} className={"flex cursor-pointer gap-3 p-4 hover:bg-slate-50 " + (selectedContactIds.has(contact.id) ? "bg-blue-50" : "")}>
                    <input type="checkbox" className="mt-1" checked={selectedContactIds.has(contact.id)} disabled={blocked} onChange={() => toggleContact(contact.id)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{contact.company}</div>
                      <div className="truncate text-xs text-slate-500">{contact.name} 様・{contact.email}</div>
                      {blocked && <div className="mt-2"><Badge tone="red">配信停止</Badge></div>}
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <FileSpreadsheet className="mx-auto size-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold">宛先リストがありません</p>
              <Button className="mt-4" onClick={() => setImportOpen(true)}>リストを読み込む</Button>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="grid gap-4 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-[1fr_180px]">
              <Field label="テンプレート">
                <select className={inputClass} value={templateId} onChange={(event) => chooseTemplate(event.target.value)}>
                  <option value="">使わずに作成</option>
                  {data?.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </Field>
              <Field label="送信間隔">
                <select className={inputClass} value={interval} onChange={(event) => setInterval(Number(event.target.value) as 5 | 10 | 30 | 60)}>
                  {[5, 10, 30, 60].map((value) => <option key={value} value={value}>{value}秒</option>)}
                </select>
              </Field>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <Field label="件名" required>
                <input className={inputClass} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="{{company}}様｜ご案内" />
              </Field>
              <Field label="差し込み項目">
                <div className="flex flex-wrap gap-2">
                  {MERGE_FIELDS.map((field) => (
                    <button type="button" key={field.key} onClick={() => insertVariable(field.key)} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700">{field.label}</button>
                  ))}
                </div>
              </Field>
              <Field label="本文" required>
                <textarea ref={bodyRef} rows={14} className={textareaClass} value={body} onChange={(event) => setBody(event.target.value)} placeholder={"{{company}}\n{{name}} 様\n\n突然のご連絡失礼いたします。"} />
              </Field>

              {firstPreview && subject && body && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold"><CheckCircle2 className="size-4 text-emerald-600" />先頭1件のプレビュー</div>
                  <div className="text-xs text-slate-500">To: {firstPreview.contact.email}</div>
                  <div className="mt-2 text-sm font-semibold">{firstPreview.subject}</div>
                  <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">{firstPreview.body}</pre>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm">
                <strong>送信可能 {eligible.length}件</strong>
                {prepared.length > eligible.length && <span className="ml-3 text-red-700">除外 {prepared.length - eligible.length}件</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <input type="email" className={inputClass + " w-56"} value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} placeholder="テスト送信先" />
                <Button variant="secondary" busy={busy} disabled={!firstPreview || !testRecipient} onClick={() => void testSend()}><FlaskConical className="size-4" />テスト</Button>
                <Button variant="danger" disabled={!ready} onClick={() => { setConsentConfirmed(false); setConfirmOpen(true); }}><Send className="size-4" />{eligible.length}件を送信</Button>
              </div>
            </div>
          </Card>

          {message && <Notice tone={successMessage ? "success" : "danger"}>{message}</Notice>}

          <Card>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-bold">最近の送信</h2><p className="text-xs text-slate-500">直近8件</p></div><MailCheck className="size-5 text-slate-400" /></div>
            {data?.campaigns.length ? (
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">日時</th><th className="px-4 py-3">対象</th><th className="px-4 py-3">成功</th><th className="px-4 py-3">失敗</th><th className="px-5 py-3">状態</th></tr></thead><tbody className="divide-y divide-slate-100">{data.campaigns.slice(0, 8).map((campaign) => <tr key={campaign.id}><td className="px-5 py-4">{formatDate(campaign.created_at, true)}</td><td className="px-4 py-4">{campaign.target_count}</td><td className="px-4 py-4 text-emerald-700">{campaign.sent_count}</td><td className="px-4 py-4 text-red-700">{campaign.failed_count}</td><td className="px-5 py-4"><Badge tone={statusTone(campaign.status)}>{campaign.status}</Badge></td></tr>)}</tbody></table></div>
            ) : <div className="p-8 text-center text-sm text-slate-500">送信履歴はまだありません</div>}
          </Card>
        </div>
      </div>

      {confirmOpen && (
        <Modal
          title="一括送信の最終確認"
          description={eligible.length + "件を個別メールとして送信します。所要時間の目安は約" + estimatedMinutes + "分です。"}
          onClose={() => setConfirmOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setConfirmOpen(false)}>戻る</Button><Button variant="danger" busy={busy} disabled={!consentConfirmed} onClick={() => void executeCampaign()}><Send className="size-4" />送信を開始</Button></>}
        >
          <div className="space-y-4">
            <Notice tone="warning">送信後は取り消せません。宛先・件名・本文を確認してください。</Notice>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950">
              <input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} className="mt-1" />
              <span><strong>送信対象者から必要な同意を得ています。</strong><br />配信停止先・購入リスト・無差別送信ではありません。</span>
            </label>
          </div>
        </Modal>
      )}

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
    </>
  );
}
