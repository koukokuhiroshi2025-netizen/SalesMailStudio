import { Check, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useAppData } from "../AppData";
import { postJson } from "../api";
import { formatDate } from "../format";
import { Badge, Button, Card, EmptyState, PageHeader, statusTone } from "../components/ui";

export function FollowupsPage() {
  const { data, refresh, setSelectedContactIds } = useAppData();
  const [busy, setBusy] = useState<string | null>(null);
  const complete = async (id: string) => { setBusy(id); try { await postJson(`/api/followups/${id}/complete`, {}, "PATCH"); await refresh(); } finally { setBusy(null); } };
  return <>
    <PageHeader title="フォロー管理" description="期限が近い顧客を優先して、次のアクションにつなげます。" />
    {(data?.followups.length ?? 0) ? <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{data?.followups.map((item) => <Card key={item.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-slate-950">{item.company}</div><div className="mt-1 text-sm text-slate-500">{item.name} 様</div></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></div><div className="my-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.content || "フォロー内容未設定"}</div><dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-500">期限</dt><dd className="mt-1 font-semibold text-red-700">{formatDate(item.due_at)}</dd></div><div><dt className="text-slate-500">前回メール</dt><dd className="mt-1 font-semibold">{formatDate(item.last_contact_at)}</dd></div></dl><div className="mt-5 flex flex-wrap gap-2"><Link to="/compose" onClick={() => setSelectedContactIds(new Set([item.contact_id]))} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white"><Mail className="size-4" />メール作成</Link><Button variant="secondary" className="h-9 px-3 text-xs"><Phone className="size-4" />電話</Button><Button busy={busy === item.id} onClick={() => void complete(item.id)} variant="ghost" className="h-9 px-3 text-xs"><Check className="size-4" />完了</Button></div></Card>)}</div> : <Card><EmptyState title="予定中のフォローはありません" description="営業リストの次回フォロー日を設定すると、ここに表示されます。" /></Card>}
  </>;
}
