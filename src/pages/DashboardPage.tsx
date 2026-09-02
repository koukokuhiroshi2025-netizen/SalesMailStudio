import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarCheck,
  MailCheck,
  MessageSquareReply,
  Trophy,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAppData } from "../AppData";
import { formatDate } from "../format";
import { Badge, Card, EmptyState, PageHeader, statusTone } from "../components/ui";

const stats = [
  { key: "contacts", label: "営業先総数", icon: Users, tone: "bg-blue-50 text-blue-700" },
  { key: "sentThisMonth", label: "今月の送信", icon: MailCheck, tone: "bg-indigo-50 text-indigo-700" },
  { key: "replies", label: "返信あり", icon: MessageSquareReply, tone: "bg-violet-50 text-violet-700" },
  { key: "appointments", label: "アポ獲得", icon: CalendarCheck, tone: "bg-emerald-50 text-emerald-700" },
  { key: "won", label: "受注", icon: Trophy, tone: "bg-amber-50 text-amber-700" },
  { key: "lost", label: "失注", icon: BriefcaseBusiness, tone: "bg-slate-100 text-slate-600" },
] as const;

export function DashboardPage() {
  const { data } = useAppData();
  if (!data) return null;
  return (
    <>
      <PageHeader title="ダッシュボード" description="今日の営業活動とメール配信状況をひと目で確認できます。" action={<Link to="/compose" className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800">メールを作成 <ArrowRight className="size-4" /></Link>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {stats.map(({ key, label, icon: Icon, tone }) => (
          <Card key={key} className="p-4">
            <div className={`grid size-9 place-items-center rounded-lg ${tone}`}><Icon className="size-[18px]" /></div>
            <div className="mt-4 text-2xl font-bold text-slate-950">{data.stats[key].toLocaleString()}</div>
            <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-bold text-slate-950">最近の配信</h2><p className="text-xs text-slate-500">直近の個別メールログ</p></div><Link to="/history" className="text-sm font-semibold text-blue-700">すべて見る</Link></div>
          {data.logs.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">送信先</th><th className="px-4 py-3">件名</th><th className="px-4 py-3">状態</th><th className="px-5 py-3">日時</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.logs.slice(0, 6).map((log) => <tr key={log.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-3.5"><div className="font-semibold text-slate-800">{log.company || log.to_address}</div><div className="text-xs text-slate-500">{log.contact_name || log.to_address}</div></td><td className="max-w-xs truncate px-4 py-3.5 text-slate-700">{log.subject}</td><td className="px-4 py-3.5"><Badge tone={statusTone(log.status)}>{log.status}</Badge></td><td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500">{formatDate(log.sent_at || log.created_at, true)}</td></tr>)}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="配信履歴はまだありません" description="テスト送信または下書き作成を行うと、ここに結果が表示されます。" />}
        </Card>
        <div className="space-y-6">
          <Card>
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold text-slate-950">今日やること</h2><p className="text-xs text-slate-500">ステータスとフォロー予定から集計</p></div>
            <div className="grid grid-cols-2 gap-px bg-slate-200">
              {Object.entries(data.stats.today).map(([label, count]) => <Link key={label} to={label === "本日フォロー" ? "/followups" : "/contacts"} className="bg-white p-4 hover:bg-blue-50"><div className="text-2xl font-bold text-slate-950">{count}</div><div className="mt-1 text-xs font-medium text-slate-500">{label}</div></Link>)}
            </div>
          </Card>
          <Card>
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold text-slate-950">キャンペーン進捗</h2></div>
            <div className="space-y-5 p-5">
              {data.campaigns.slice(0, 3).map((campaign) => {
                const completed = campaign.sent_count + campaign.draft_count + campaign.failed_count;
                const percentage = campaign.target_count ? Math.round(completed / campaign.target_count * 100) : 0;
                return <div key={campaign.id}><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-semibold text-slate-800">{campaign.name}</span><span className="text-xs text-slate-500">{completed}/{campaign.target_count}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${percentage}%` }} /></div></div>;
              })}
              {!data.campaigns.length && <p className="py-5 text-center text-sm text-slate-500">進行中の配信はありません</p>}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
