import { ChevronLeft, ChevronRight, Mail, Plus, Search, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../AppData";
import { api, postJson } from "../api";
import { ImportDialog } from "../components/ImportDialog";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, inputClass, statusTone } from "../components/ui";
import { formatDate } from "../format";

const PAGE_SIZE = 20;

export function ContactsPage() {
  const { data, refresh, selectedContactIds, setSelectedContactIds } = useAppData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [rank, setRank] = useState("");
  const [rep, setRep] = useState("");
  const [page, setPage] = useState(1);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("送信予定");

  const filtered = useMemo(() => (data?.contacts ?? []).filter((contact) =>
    (!query || [contact.company, contact.name, contact.email].some((value) => value.toLowerCase().includes(query.toLowerCase()))) &&
    (!status || contact.status === status) && (!rank || contact.rank === rank) && (!rep || contact.sales_rep === rep)
  ), [data, query, status, rank, rep]);
  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const reps = [...new Set((data?.contacts ?? []).map((item) => item.sales_rep).filter(Boolean))];
  const toggle = (id: string) => { const next = new Set(selectedContactIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedContactIds(next); };
  const togglePage = () => { const next = new Set(selectedContactIds); const all = current.every((item) => next.has(item.id)); current.forEach((item) => all ? next.delete(item.id) : next.add(item.id)); setSelectedContactIds(next); };
  const applyStatus = async () => { if (!selectedContactIds.size) return; setBusy(true); try { await postJson("/api/contacts/bulk-status", { ids: [...selectedContactIds], status: bulkStatus }, "PATCH"); await refresh(); } finally { setBusy(false); } };
  const remove = async (id: string) => { if (!window.confirm("この顧客を削除しますか？配信履歴は保持されます。")) return; await api(`/api/contacts/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }); const next = new Set(selectedContactIds); next.delete(id); setSelectedContactIds(next); await refresh(); };

  return <>
    <PageHeader title="営業リスト" description="顧客情報を検索・絞り込みし、安全な送信対象を選択します。" action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setShowImport(true)}><Upload className="size-4" />Excel / CSV取込</Button><Button onClick={() => setShowAdd(true)}><Plus className="size-4" />顧客を追加</Button></div>} />
    <Card>
      <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(220px,1fr)_180px_130px_160px]">
        <div className="relative"><Search className="absolute left-3 top-2.5 size-5 text-slate-400" /><input className={`${inputClass} pl-10`} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="会社名・氏名・メールで検索" /></div>
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">すべてのステータス</option>{["未アプローチ","送信予定","送信済","返信待ち","返信あり","アポ獲得","再提案","受注","失注","保留","対象外"].map((item) => <option key={item}>{item}</option>)}</select>
        <select className={inputClass} value={rank} onChange={(event) => setRank(event.target.value)}><option value="">全ランク</option>{["A","B","C","D","OUT"].map((item) => <option key={item}>{item}</option>)}</select>
        <select className={inputClass} value={rep} onChange={(event) => setRep(event.target.value)}><option value="">すべての営業担当</option>{reps.map((item) => <option key={item!}>{item}</option>)}</select>
      </div>
      {selectedContactIds.size > 0 && <div className="flex flex-col gap-3 border-b border-blue-200 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center"><div className="text-sm font-semibold text-blue-900">{selectedContactIds.size}件を選択中</div><div className="flex flex-1 flex-wrap gap-2 sm:justify-end"><select className="h-9 rounded-lg border border-blue-300 bg-white px-3 text-xs" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>{["送信予定","返信待ち","返信あり","アポ獲得","再提案","保留","対象外"].map((item) => <option key={item}>{item}</option>)}</select><Button busy={busy} variant="secondary" className="h-9 text-xs" onClick={() => void applyStatus()}>一括ステータス変更</Button><Link to="/compose" className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white"><Mail className="size-4" />メール作成</Link></div></div>}
      {current.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3"><input type="checkbox" checked={current.every((item) => selectedContactIds.has(item.id))} onChange={togglePage} /></th><th className="px-4 py-3">会社名</th><th className="px-4 py-3">氏名 / 役職</th><th className="px-4 py-3">メール</th><th className="px-4 py-3">電話</th><th className="px-4 py-3">担当</th><th className="px-4 py-3">ランク</th><th className="px-4 py-3">ステータス</th><th className="px-4 py-3">最終送信</th><th className="px-4 py-3">次回フォロー</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{current.map((contact) => <tr key={contact.id} className={selectedContactIds.has(contact.id) ? "bg-blue-50/60" : "hover:bg-slate-50"}><td className="px-4 py-3"><input type="checkbox" checked={selectedContactIds.has(contact.id)} onChange={() => toggle(contact.id)} /></td><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{contact.company}</td><td className="whitespace-nowrap px-4 py-3"><div>{contact.name}</div><div className="text-xs text-slate-500">{[contact.department, contact.position].filter(Boolean).join(" / ") || "—"}</div></td><td className="px-4 py-3 text-blue-700">{contact.email}</td><td className="whitespace-nowrap px-4 py-3">{contact.phone || "—"}</td><td className="px-4 py-3">{contact.sales_rep || "—"}</td><td className="px-4 py-3"><Badge tone={contact.rank === "A" ? "red" : contact.rank === "B" ? "amber" : "slate"}>{contact.rank || "OUT"}</Badge></td><td className="px-4 py-3"><Badge tone={statusTone(contact.status)}>{contact.status}</Badge></td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDate(contact.last_contact_at)}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDate(contact.next_followup_at)}</td><td className="px-4 py-3"><button onClick={() => void remove(contact.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="削除"><Trash2 className="size-4" /></button></td></tr>)}</tbody></table></div> : <EmptyState title="顧客が見つかりません" description="検索条件を変更するか、Excel / CSVから営業リストを取り込んでください。" />}
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500"><span>{filtered.length}件中 {(page - 1) * PAGE_SIZE + (filtered.length ? 1 : 0)}〜{Math.min(page * PAGE_SIZE, filtered.length)}件</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronLeft className="size-4" /></button><span>{page} / {maxPage}</span><button disabled={page >= maxPage} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronRight className="size-4" /></button></div></div>
    </Card>
    {showImport && <ImportDialog onClose={() => setShowImport(false)} />}
    {showAdd && <AddContactDialog onClose={() => setShowAdd(false)} />}
  </>;
}

function AddContactDialog({ onClose }: { onClose: () => void }) {
  const { refresh } = useAppData();
  const [form, setForm] = useState({ company: "", name: "", email: "", department: "", position: "", phone: "", industry: "", area: "", sales_rep: "", rank: "OUT", status: "未アプローチ", issue: "", service: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => { setBusy(true); setError(""); try { await postJson("/api/contacts", form); await refresh(); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : "登録できませんでした"); } finally { setBusy(false); } };
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <Modal title="顧客を追加" description="最低限、会社名・氏名・メールアドレスを入力してください。" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>キャンセル</Button><Button busy={busy} disabled={!form.company || !form.name || !form.email} onClick={() => void save()}>登録する</Button></>}>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="会社名" required><input className={inputClass} value={form.company} onChange={(event) => update("company", event.target.value)} /></Field><Field label="氏名" required><input className={inputClass} value={form.name} onChange={(event) => update("name", event.target.value)} /></Field><Field label="メールアドレス" required><input type="email" className={inputClass} value={form.email} onChange={(event) => update("email", event.target.value)} /></Field><Field label="電話番号"><input className={inputClass} value={form.phone} onChange={(event) => update("phone", event.target.value)} /></Field><Field label="部署"><input className={inputClass} value={form.department} onChange={(event) => update("department", event.target.value)} /></Field><Field label="役職"><input className={inputClass} value={form.position} onChange={(event) => update("position", event.target.value)} /></Field><Field label="営業担当"><input className={inputClass} value={form.sales_rep} onChange={(event) => update("sales_rep", event.target.value)} /></Field><Field label="重要ランク"><select className={inputClass} value={form.rank} onChange={(event) => update("rank", event.target.value)}>{["A","B","C","D","OUT"].map((item) => <option key={item}>{item}</option>)}</select></Field></div>
    {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
  </Modal>;
}
