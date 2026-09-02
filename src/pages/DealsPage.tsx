import { useState } from "react";
import { useAppData } from "../AppData";
import { formatCurrency, formatDate } from "../format";
import { Badge, Card, EmptyState, PageHeader, statusTone } from "../components/ui";

const stages = ["アポ", "ヒアリング", "提案", "見積", "クロージング", "受注", "失注"];

export function DealsPage() {
  const { data } = useAppData();
  const [view, setView] = useState<"table" | "kanban">("table");
  return <>
    <PageHeader title="商談管理" description="営業メール後の商談を、金額と次アクションまで管理します。" action={<div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 text-xs font-semibold"><button onClick={() => setView("table")} className={`rounded-md px-3 py-1.5 ${view === "table" ? "bg-slate-900 text-white" : "text-slate-600"}`}>テーブル</button><button onClick={() => setView("kanban")} className={`rounded-md px-3 py-1.5 ${view === "kanban" ? "bg-slate-900 text-white" : "text-slate-600"}`}>カンバン</button></div>} />
    {view === "table" ? <Card>{data?.deals.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">会社名</th><th className="px-4 py-3">商談担当</th><th className="px-4 py-3">ステータス</th><th className="px-4 py-3">受注予定</th><th className="px-4 py-3">見込金額</th><th className="px-4 py-3">確度</th><th className="px-5 py-3">次回アクション</th></tr></thead><tbody className="divide-y divide-slate-100">{data.deals.map((deal) => <tr key={deal.id}><td className="px-5 py-4"><div className="font-semibold">{deal.company}</div><div className="text-xs text-slate-500">{deal.name} 様</div></td><td className="px-4 py-4">{deal.sales_rep || "—"}</td><td className="px-4 py-4"><Badge tone={statusTone(deal.status)}>{deal.status}</Badge></td><td className="px-4 py-4">{formatDate(deal.expected_close_date)}</td><td className="px-4 py-4 font-semibold">{formatCurrency(deal.amount)}</td><td className="px-4 py-4">{deal.probability}%</td><td className="px-5 py-4">{deal.next_action || "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="商談はまだありません" description="アポ獲得後に商談を登録すると表示されます。" />}</Card> : <div className="flex gap-4 overflow-x-auto pb-4">{stages.map((stage) => <div key={stage} className="w-72 shrink-0"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-slate-700">{stage}</h3><Badge>{data?.deals.filter((deal) => deal.status === stage).length ?? 0}</Badge></div><div className="space-y-3">{data?.deals.filter((deal) => deal.status === stage).map((deal) => <Card key={deal.id} className="p-4"><div className="font-semibold">{deal.company}</div><div className="mt-1 text-xs text-slate-500">{deal.name} 様</div><div className="mt-4 font-bold text-slate-900">{formatCurrency(deal.amount)}</div><div className="mt-2 text-xs text-slate-500">{deal.next_action}</div></Card>)}</div></div>)}</div>}
  </>;
}
