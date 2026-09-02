import { Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppData } from "../AppData";
import { api, postJson } from "../api";
import { Button, Card, EmptyState, Field, Modal, PageHeader, inputClass } from "../components/ui";
import { formatDate } from "../format";

export function UnsubscribesPage() {
  const { data, refresh } = useAppData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => (data?.unsubscribes ?? []).filter((item) => item.email.includes(query.toLowerCase())), [data, query]);
  const remove = async (id: string) => { if (!window.confirm("除外リストから解除しますか？")) return; await api(`/api/unsubscribes/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }); await refresh(); };
  return <>
    <PageHeader title="除外リスト" description="配信停止・退職・送信エラーなど、送ってはいけない宛先を一元管理します。" action={<Button onClick={() => setOpen(true)}><Plus className="size-4" />除外先を登録</Button>} />
    <Card>
      <div className="border-b border-slate-200 p-4"><div className="relative max-w-xl"><Search className="absolute left-3 top-2.5 size-5 text-slate-400" /><input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="メールアドレスで検索" /></div></div>
      {rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">メールアドレス</th><th className="px-4 py-3">理由</th><th className="px-4 py-3">登録日</th><th className="px-4 py-3">登録者</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((item) => <tr key={item.id}><td className="px-5 py-4 font-semibold">{item.email}</td><td className="px-4 py-4">{item.reason}</td><td className="px-4 py-4 text-slate-500">{formatDate(item.created_at)}</td><td className="px-4 py-4">{item.created_by}</td><td className="px-5 py-4 text-right"><button onClick={() => void remove(item.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button></td></tr>)}</tbody></table></div> : <EmptyState title="除外先はありません" description="登録したアドレスは、一括メール作成時に自動で除外されます。" />}
    </Card>
    {open && <AddUnsubscribe onClose={() => setOpen(false)} />}
  </>;
}

function AddUnsubscribe({ onClose }: { onClose: () => void }) {
  const { refresh } = useAppData();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("手動登録");
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await postJson("/api/unsubscribes", { email, reason, source: "manual" }); await refresh(); onClose(); } finally { setBusy(false); } };
  return <Modal title="除外先を登録" description="登録後、このアドレスにはメールを送信できません。" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>キャンセル</Button><Button busy={busy} disabled={!email} onClick={() => void save()}>登録</Button></>}><div className="space-y-4"><Field label="メールアドレス" required><input type="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field label="理由" required><select className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)}>{["配信停止希望","送信エラー","退職","対象外","手動登録"].map((item) => <option key={item}>{item}</option>)}</select></Field></div></Modal>;
}
