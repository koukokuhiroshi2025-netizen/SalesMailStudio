import { FileText, Plus, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MERGE_FIELDS } from "../../shared/template";
import type { MailTemplate } from "../../shared/types";
import { useAppData } from "../AppData";
import { postJson } from "../api";
import { Badge, Button, Card, EmptyState, Field, PageHeader, inputClass, textareaClass } from "../components/ui";
import { formatDate } from "../format";

const empty = { name: "", purpose: "新規営業", subject: "", body: "", signature: "" };

export function TemplatesPage() {
  const { data, refresh } = useAppData();
  const [selected, setSelected] = useState<MailTemplate | null>(data?.templates[0] ?? null);
  const [form, setForm] = useState(selected ? { name: selected.name, purpose: selected.purpose, subject: selected.subject, body: selected.body, signature: selected.signature ?? "" } : empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (selected) setForm({ name: selected.name, purpose: selected.purpose, subject: selected.subject, body: selected.body, signature: selected.signature ?? "" });
    else setForm(empty);
  }, [selected]);

  const insertVariable = (key: string) => {
    const target = bodyRef.current;
    const token = `{{${key}}}`;
    if (!target) return setForm((current) => ({ ...current, body: current.body + token }));
    const start = target.selectionStart;
    const end = target.selectionEnd;
    setForm((current) => ({ ...current, body: current.body.slice(0, start) + token + current.body.slice(end) }));
    requestAnimationFrame(() => { target.focus(); target.setSelectionRange(start + token.length, start + token.length); });
  };

  const save = async () => {
    setBusy(true); setMessage("");
    try {
      if (selected) await postJson(`/api/templates/${selected.id}`, form, "PUT");
      else await postJson("/api/templates", form);
      await refresh();
      setMessage("保存しました");
      if (!selected) setForm(empty);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "保存に失敗しました"); }
    finally { setBusy(false); }
  };

  return <>
    <PageHeader title="テンプレート" description="用途別の件名・本文・署名と差し込み項目を管理します。" action={<Button variant="secondary" onClick={() => setSelected(null)}><Plus className="size-4" />新規テンプレート</Button>} />
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="h-fit overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-800">保存済みテンプレート</div>
        {data?.templates.length ? <div className="divide-y divide-slate-100">{data.templates.map((template) => <button key={template.id} onClick={() => setSelected(template)} className={`w-full p-4 text-left transition hover:bg-slate-50 ${selected?.id === template.id ? "bg-blue-50" : ""}`}><div className="flex items-start gap-3"><div className="rounded-lg bg-slate-100 p-2"><FileText className="size-4 text-slate-600" /></div><div className="min-w-0"><div className="truncate font-semibold text-slate-900">{template.name}</div><div className="mt-1"><Badge tone="blue">{template.purpose}</Badge></div><div className="mt-2 text-xs text-slate-500">更新 {formatDate(template.updated_at)}</div></div></div></button>)}</div> : <EmptyState title="テンプレートがありません" description="右側のフォームから作成できます。" />}
      </Card>
      <Card className="p-5 sm:p-6">
        <div className="mb-5"><h2 className="text-lg font-bold">{selected ? "テンプレートを編集" : "新規テンプレート"}</h2><p className="mt-1 text-xs text-slate-500">プレーンテキストメールとして送信されます。</p></div>
        <div className="grid gap-5 sm:grid-cols-2"><Field label="テンプレート名" required><input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="用途" required><select className={inputClass} value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })}>{["新規営業","セミナー案内","既存顧客フォロー","アポ依頼","商談後フォロー","休眠顧客","その他"].map((item) => <option key={item}>{item}</option>)}</select></Field></div>
        <div className="mt-5"><Field label="件名" required><input className={inputClass} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="{{company}}様｜ご提案のご案内" /></Field></div>
        <div className="mt-5"><Field label="差し込み項目を挿入" hint="クリックすると本文のカーソル位置に挿入します。"><div className="flex flex-wrap gap-2">{MERGE_FIELDS.map((field) => <button key={field.key} type="button" onClick={() => insertVariable(field.key)} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">{field.label}</button>)}</div></Field></div>
        <div className="mt-5"><Field label="本文" required><textarea ref={bodyRef} rows={14} className={textareaClass} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></Field></div>
        <div className="mt-5"><Field label="署名"><textarea rows={5} className={textareaClass} value={form.signature} onChange={(event) => setForm({ ...form, signature: event.target.value })} /></Field></div>
        <div className="mt-6 flex items-center justify-end gap-3">{message && <span className={`mr-auto text-sm ${message === "保存しました" ? "text-emerald-700" : "text-red-700"}`}>{message}</span>}<Button busy={busy} disabled={!form.name || !form.subject || !form.body} onClick={() => void save()}><Save className="size-4" />保存</Button></div>
      </Card>
    </div>
  </>;
}
