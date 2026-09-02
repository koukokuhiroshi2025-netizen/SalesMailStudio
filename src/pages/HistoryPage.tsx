import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppData } from "../AppData";
import { formatDate } from "../format";
import { Badge, Card, EmptyState, PageHeader, inputClass, statusTone } from "../components/ui";

export function HistoryPage() {
  const { data } = useAppData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const logs = useMemo(() => (data?.logs ?? []).filter((log) =>
    (!status || log.status === status) &&
    (!query || [log.company, log.contact_name, log.to_address, log.subject].some((value) => value?.toLowerCase().includes(query.toLowerCase())))
  ), [data, query, status]);
  return <>
    <PageHeader title="配信履歴" description="メール1通ごとの処理結果とエラーを追跡します。" />
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} pl-10`} placeholder="会社名・宛先・件名で検索" /></div>
        <select className={`${inputClass} sm:w-48`} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">すべての状態</option>{["pending","processing","sent","drafted","failed","cancelled"].map((item) => <option key={item}>{item}</option>)}</select>
      </div>
      {logs.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">日時</th><th className="px-4 py-3">会社・氏名</th><th className="px-4 py-3">送信先</th><th className="px-4 py-3">件名</th><th className="px-4 py-3">送信方法</th><th className="px-4 py-3">状態</th><th className="px-5 py-3">エラー</th></tr></thead><tbody className="divide-y divide-slate-100">{logs.map((log) => <tr key={log.id}><td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500">{formatDate(log.sent_at || log.created_at, true)}</td><td className="whitespace-nowrap px-4 py-3.5"><div className="font-semibold">{log.company || "—"}</div><div className="text-xs text-slate-500">{log.contact_name || "—"}</div></td><td className="px-4 py-3.5">{log.to_address}</td><td className="max-w-xs truncate px-4 py-3.5">{log.subject}</td><td className="px-4 py-3.5">{log.provider}</td><td className="px-4 py-3.5"><Badge tone={statusTone(log.status)}>{log.status}</Badge></td><td className="max-w-xs px-5 py-3.5 text-xs text-red-700">{log.error_message || "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="条件に一致する履歴がありません" description="検索条件を変更してください。" />}
    </Card>
  </>;
}
