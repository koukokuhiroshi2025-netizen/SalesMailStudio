import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FlaskConical,
  Mail,
  Search,
  Send,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MERGE_FIELDS, contactToMergeData, renderTemplate } from "../../shared/template";
import type { Contact, MailTemplate } from "../../shared/types";
import { useAppData } from "../AppData";
import { postJson } from "../api";
import { Badge, Button, Card, Field, Modal, Notice, PageHeader, inputClass, statusTone, textareaClass } from "../components/ui";
import { formatDate } from "../format";

interface PreparedMail {
  contact: Contact;
  subject: string;
  body: string;
  unresolved: string[];
  blockedReason?: string;
}

export function ComposerPage() {
  const { pathname } = useLocation();
  const distributionMode = pathname === "/campaigns";
  const { data, refresh, selectedContactIds, setSelectedContactIds } = useAppData();
  const [query, setQuery] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [mode, setMode] = useState<"send" | "draft">("draft");
  const [interval, setInterval] = useState<5 | 10 | 30 | 60>(10);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState(data?.user.email ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const blockedEmails = useMemo(() => new Set(data?.unsubscribes.map((item) => item.email.toLowerCase()) ?? []), [data]);
  const selectedContacts = useMemo(() => (data?.contacts ?? []).filter((contact) => selectedContactIds.has(contact.id)), [data, selectedContactIds]);
  const prepared = useMemo<PreparedMail[]>(() => selectedContacts.map((contact) => {
    const merge = contactToMergeData(contact);
    const renderedSubject = renderTemplate(subject, merge);
    const renderedBody = renderTemplate(body, merge);
    return {
      contact,
      subject: renderedSubject.content,
      body: renderedBody.content,
      unresolved: [...new Set([...renderedSubject.unresolved, ...renderedBody.unresolved])],
      blockedReason: blockedEmails.has(contact.email.toLowerCase()) ? "配信停止リスト" : undefined,
    };
  }), [selectedContacts, subject, body, blockedEmails]);
  const eligible = prepared.filter((item) => !item.blockedReason && item.unresolved.length === 0);
  const unresolvedCount = prepared.filter((item) => item.unresolved.length > 0).length;
  const filteredContacts = (data?.contacts ?? []).filter((contact) => [contact.company, contact.name, contact.email].some((value) => value.toLowerCase().includes(query.toLowerCase())));
  const currentPreview = prepared[previewIndex];

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    const template = data?.templates.find((item) => item.id === id);
    if (!template) return;
    setSubject(template.subject);
    setBody(template.body + (template.signature ? `\n\n${template.signature}` : ""));
    if (!campaignName) setCampaignName(template.name);
  };
  const toggleContact = (id: string) => { const next = new Set(selectedContactIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedContactIds(next); };
  const insertVariable = (key: string) => {
    const target = bodyRef.current;
    const token = `{{${key}}}`;
    if (!target) return setBody((value) => value + token);
    const start = target.selectionStart;
    const end = target.selectionEnd;
    setBody((value) => value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => { target.focus(); target.setSelectionRange(start + token.length, start + token.length); });
  };
  const openPreview = () => { setPreviewIndex(0); setPreviewOpen(true); };
  const startCampaign = () => {
    setMessage("");
    if (!eligible.length) return setMessage("差し込み未展開または配信停止のため、処理できる対象がありません。");
    setConfirmOpen(true);
  };
  const executeCampaign = async () => {
    setBusy(true); setMessage("");
    try {
      const result = await postJson<{ queued: number; skipped: unknown[] }>("/api/campaigns", {
        name: campaignName || `${new Date().toLocaleDateString("ja-JP")} メール配信`,
        templateId: templateId || undefined,
        contactIds: selectedContacts.map((contact) => contact.id),
        subject,
        body,
        cc,
        bcc,
        mode,
        intervalSeconds: interval,
        confirmedCount: eligible.length,
      });
      setConfirmOpen(false);
      setMessage(`${result.queued}件を${mode === "draft" ? "下書き作成" : "送信"}キューへ登録しました。`);
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "配信を開始できませんでした");
    } finally {
      setBusy(false);
    }
  };
  const testSend = async () => {
    if (!currentPreview && !eligible[0]) return;
    const mail = currentPreview ?? eligible[0]!;
    setBusy(true);
    try {
      await postJson("/api/mail/test-send", { to: testRecipient, subject: mail.subject, body: mail.body });
      setTestOpen(false);
      setMessage(`${testRecipient}へテスト送信しました。`);
      await refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "テスト送信に失敗しました"); }
    finally { setBusy(false); }
  };

  return <>
    <PageHeader title={distributionMode ? "メール配信" : "メール作成"} description={distributionMode ? "対象・テンプレート・送信方法を確認してキャンペーンを開始します。" : "一般的なメールソフトと同じ感覚で、個別化された営業メールを作成します。"} />
    <div className="grid gap-6 2xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit max-h-[calc(100vh-150px)] overflow-hidden">
        <div className="border-b border-slate-200 p-4"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">送信対象</h2><p className="text-xs text-slate-500">{selectedContactIds.size}件を選択中</p></div><button onClick={() => setSelectedContactIds(new Set())} className="text-xs font-semibold text-blue-700">解除</button></div><div className="relative mt-3"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="会社名・氏名で検索" /></div></div>
        <div className="max-h-[calc(100vh-310px)] overflow-y-auto divide-y divide-slate-100">{filteredContacts.map((contact) => <label key={contact.id} className={`flex cursor-pointer gap-3 p-4 hover:bg-slate-50 ${selectedContactIds.has(contact.id) ? "bg-blue-50" : ""}`}><input type="checkbox" className="mt-1" checked={selectedContactIds.has(contact.id)} onChange={() => toggleContact(contact.id)} /><div className="min-w-0 flex-1"><div className="truncate font-semibold text-slate-900">{contact.company}</div><div className="mt-0.5 truncate text-xs text-slate-500">{contact.name} 様・{contact.email}</div><div className="mt-2 flex gap-2"><Badge tone={statusTone(contact.status)}>{contact.status}</Badge>{blockedEmails.has(contact.email.toLowerCase()) && <Badge tone="red">除外</Badge>}</div></div></label>)}</div>
      </Card>
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="grid gap-4 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
            <Field label="送信アカウント"><select className={inputClass}>{data?.mailAccounts.map((account) => <option key={account.id} value={account.id}>{account.display_name}（{account.provider}）</option>)}</select></Field>
            <Field label="テンプレート"><select className={inputClass} value={templateId} onChange={(event) => chooseTemplate(event.target.value)}><option value="">テンプレートを選択</option>{data?.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field>
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-5 md:grid-cols-2"><Field label="キャンペーン名"><input className={inputClass} value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="例: 2026年9月 AI研修案内" /></Field><Field label="送信方法"><div className="grid grid-cols-2 gap-2"><button onClick={() => setMode("draft")} className={`h-10 rounded-lg border text-sm font-semibold ${mode === "draft" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"}`}>Garoon下書き</button><button onClick={() => setMode("send")} className={`h-10 rounded-lg border text-sm font-semibold ${mode === "send" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-300 text-slate-600"}`}>個別送信</button></div></Field></div>
            <div className="grid gap-5 md:grid-cols-2"><Field label="Cc"><input className={inputClass} value={cc} onChange={(event) => setCc(event.target.value)} placeholder="任意" /></Field><Field label="Bcc"><input className={inputClass} value={bcc} onChange={(event) => setBcc(event.target.value)} placeholder="任意" /></Field></div>
            <Field label="件名" required><input className={inputClass} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="{{company}}様｜ご案内" /></Field>
            <Field label="差し込み項目を挿入"><div className="flex flex-wrap gap-2">{MERGE_FIELDS.map((field) => <button key={field.key} onClick={() => insertVariable(field.key)} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700">{field.label}</button>)}</div></Field>
            <Field label="本文" required hint="Garoon連携はプレーンテキストで送信します。"><textarea ref={bodyRef} rows={16} className={textareaClass} value={body} onChange={(event) => setBody(event.target.value)} placeholder="{{company}}&#10;{{name}} 様&#10;&#10;突然のご連絡失礼いたします。" /></Field>
            <div className="grid gap-5 md:grid-cols-2"><Field label="送信間隔"><select className={inputClass} value={interval} onChange={(event) => setInterval(Number(event.target.value) as 5 | 10 | 30 | 60)}>{[5,10,30,60].map((value) => <option key={value} value={value}>{value}秒</option>)}</select></Field><div className="flex items-end"><Notice tone="info">BCC一斉送信ではなく、1社ずつ個別メールとして処理します。</Notice></div></div>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm"><span className="font-bold text-slate-900">処理可能 {eligible.length}件</span>{unresolvedCount > 0 && <span className="ml-3 text-red-700">未展開あり {unresolvedCount}件</span>}</div><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={!prepared.length || !subject || !body} onClick={openPreview}><Eye className="size-4" />プレビュー</Button><Button variant="secondary" disabled={!eligible.length} onClick={() => { setPreviewIndex(Math.max(0, prepared.indexOf(eligible[0]!))); setTestOpen(true); }}><FlaskConical className="size-4" />自分にテスト送信</Button><Button variant={mode === "send" ? "danger" : "primary"} disabled={!eligible.length || !subject || !body} onClick={startCampaign}>{mode === "send" ? <Send className="size-4" /> : <Mail className="size-4" />}{mode === "send" ? "送信確認へ" : "下書き作成へ"}</Button></div></div>
        </Card>
        {message && <Notice tone={message.includes("登録しました") || message.includes("テスト送信しました") ? "success" : "danger"}>{message}</Notice>}
        {distributionMode && <CampaignList />}
      </div>
    </div>
    {previewOpen && currentPreview && <Modal wide title="送信プレビュー" description={`${previewIndex + 1} / ${prepared.length}件：${currentPreview.contact.company} ${currentPreview.contact.name}様`} onClose={() => setPreviewOpen(false)} footer={<><Button variant="secondary" disabled={previewIndex === 0} onClick={() => setPreviewIndex((value) => value - 1)}><ChevronLeft className="size-4" />前へ</Button><Button variant="secondary" disabled={previewIndex >= prepared.length - 1} onClick={() => setPreviewIndex((value) => value + 1)}>次へ<ChevronRight className="size-4" /></Button><Button onClick={() => setPreviewOpen(false)}>確認完了</Button></>}>
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]"><div className="overflow-hidden rounded-xl border border-slate-200"><dl className="grid grid-cols-[90px_1fr] border-b border-slate-200 text-sm"><dt className="bg-slate-50 px-4 py-3 font-semibold">To</dt><dd className="px-4 py-3">{currentPreview.contact.email}</dd><dt className="bg-slate-50 px-4 py-3 font-semibold">会社名</dt><dd className="px-4 py-3">{currentPreview.contact.company}</dd><dt className="bg-slate-50 px-4 py-3 font-semibold">件名</dt><dd className="px-4 py-3 font-semibold">{currentPreview.subject}</dd></dl><pre className="min-h-80 whitespace-pre-wrap p-5 font-sans text-sm leading-7 text-slate-800">{currentPreview.body}</pre></div><div className="space-y-4">{currentPreview.blockedReason && <Notice tone="danger">{currentPreview.blockedReason}のため処理できません。</Notice>}{currentPreview.unresolved.length ? <Notice tone="danger"><strong>未展開の項目:</strong><br />{currentPreview.unresolved.map((field) => `{{${field}}}`).join("、")}<br />本番送信はできません。</Notice> : <Notice tone="success"><CheckCircle2 className="sr-only" />すべての差し込み項目が展開されています。</Notice>}<div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">送信予定時刻: {mode === "send" ? `開始から約${Math.ceil(previewIndex * interval / 60)}分後` : "Garoon下書きへ順次保存"}</div></div></div>
    </Modal>}
    {confirmOpen && <Modal title={mode === "send" ? "一括送信の最終確認" : "Garoon下書き作成の確認"} description="件数・送信元・テンプレートを再確認してください。" onClose={() => setConfirmOpen(false)} footer={<><Button variant="secondary" onClick={() => setConfirmOpen(false)}>戻る</Button><Button variant={mode === "send" ? "danger" : "primary"} busy={busy} onClick={() => void executeCampaign()}>{mode === "send" ? "送信を開始" : "下書きを作成"}</Button></>}>
      <div className="space-y-4"><Notice tone={mode === "send" ? "warning" : "info"}><strong>{eligible.length}通のメールを{mode === "send" ? "送信" : "下書き保存"}します。</strong><br />全宛先は個別メールとして処理され、除外リストと未展開項目は再度API側で確認されます。</Notice><dl className="grid grid-cols-[120px_1fr] gap-y-3 rounded-lg bg-slate-50 p-4 text-sm"><dt className="text-slate-500">送信対象</dt><dd className="font-semibold">{eligible.length}件</dd><dt className="text-slate-500">除外</dt><dd>{prepared.length - eligible.length}件</dd><dt className="text-slate-500">プロバイダー</dt><dd>{data?.provider}</dd><dt className="text-slate-500">キャンペーン</dt><dd>{campaignName || "名称未設定"}</dd><dt className="text-slate-500">処理間隔</dt><dd>{interval}秒</dd></dl>{mode === "send" && <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><AlertTriangle className="mt-0.5 size-5 shrink-0" />対象者から送信許諾を得ており、営業目的として適切な配信であることを確認してください。</div>}</div>
    </Modal>}
    {testOpen && <Modal title="自分宛てにテスト送信" description="件名の先頭に [TEST] を付けて送信します。" onClose={() => setTestOpen(false)} footer={<><Button variant="secondary" onClick={() => setTestOpen(false)}>キャンセル</Button><Button busy={busy} disabled={!testRecipient} onClick={() => void testSend()}><FlaskConical className="size-4" />テスト送信</Button></>}><Field label="テスト送信先" required><input type="email" className={inputClass} value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} /></Field></Modal>}
  </>;
}

function CampaignList() {
  const { data } = useAppData();
  return <Card><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold">最近のキャンペーン</h2></div>{data?.campaigns.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">キャンペーン</th><th className="px-4 py-3">作成日</th><th className="px-4 py-3">方法</th><th className="px-4 py-3">対象</th><th className="px-4 py-3">成功</th><th className="px-4 py-3">失敗</th><th className="px-5 py-3">状態</th></tr></thead><tbody className="divide-y divide-slate-100">{data.campaigns.map((campaign) => <tr key={campaign.id}><td className="px-5 py-4 font-semibold">{campaign.name}</td><td className="px-4 py-4 text-slate-500">{formatDate(campaign.created_at, true)}</td><td className="px-4 py-4">{campaign.mode}</td><td className="px-4 py-4">{campaign.target_count}</td><td className="px-4 py-4 text-emerald-700">{campaign.sent_count + campaign.draft_count}</td><td className="px-4 py-4 text-red-700">{campaign.failed_count}</td><td className="px-5 py-4"><Badge tone={statusTone(campaign.status)}>{campaign.status}</Badge></td></tr>)}</tbody></table></div> : <div className="p-8 text-center text-sm text-slate-500">キャンペーンはまだありません</div>}</Card>;
}
