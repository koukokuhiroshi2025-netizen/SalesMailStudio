import { LogOut, Save, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAppData } from "../AppData";
import { postJson } from "../api";
import { Button, Card, Field, Notice, PageHeader, inputClass } from "../components/ui";

export function SettingsPage() {
  const { data, refresh, logout } = useAppData();
  const [maxBatch, setMaxBatch] = useState(Number(data?.settings.max_batch_size ?? 100));
  const [interval, setInterval] = useState(Number(data?.settings.send_interval_seconds ?? 10));
  const [unsubscribe, setUnsubscribe] = useState(data?.settings.append_unsubscribe === "true");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async () => { setBusy(true); setSaved(false); try { await postJson("/api/settings", { max_batch_size: maxBatch, send_interval_seconds: interval, append_unsubscribe: unsubscribe }, "PATCH"); await refresh(); setSaved(true); } finally { setBusy(false); } };
  return <>
    <PageHeader title="設定" description="誤送信防止と配信ルールを組織の運用に合わせて調整します。" />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="p-6"><h2 className="font-bold text-slate-950">一括配信の安全設定</h2><p className="mt-1 text-sm text-slate-500">初期値は安全側に設定されています。</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="1回の最大処理件数" hint="この件数を超える配信はAPI側でも拒否します。"><input type="number" min={1} max={500} className={inputClass} value={maxBatch} onChange={(event) => setMaxBatch(Number(event.target.value))} /></Field><Field label="送信間隔"><select className={inputClass} value={interval} onChange={(event) => setInterval(Number(event.target.value))}>{[5,10,30,60].map((value) => <option key={value} value={value}>{value}秒</option>)}</select></Field></div><label className="mt-6 flex items-start gap-3 rounded-lg border border-slate-200 p-4"><input type="checkbox" className="mt-1" checked={unsubscribe} onChange={(event) => setUnsubscribe(event.target.checked)} /><span><span className="block text-sm font-semibold text-slate-800">本文末尾に配信停止案内を追加</span><span className="mt-1 block text-xs text-slate-500">MVPではURL発行前のため、設定値だけを保持します。実際の挿入はPhase 2です。</span></span></label>{saved && <div className="mt-5"><Notice tone="success">設定を保存しました</Notice></div>}<div className="mt-6 flex justify-end"><Button busy={busy} onClick={() => void save()}><Save className="size-4" />設定を保存</Button></div></Card>
      <div className="space-y-5"><Notice tone="warning">不特定多数への無差別送信、購入リスト、取得経路が不明なアドレスへの配信には使用しないでください。</Notice><Card className="p-5"><div className="flex gap-3"><ShieldCheck className="size-6 text-emerald-600" /><div><h3 className="font-bold">セキュリティ</h3><p className="mt-1 text-sm text-slate-500">認証情報はSecrets管理、CookieはHttpOnly、すべての更新APIは同一オリジンを確認します。</p></div></div></Card><Card className="p-5"><h3 className="font-bold">アカウント</h3><p className="mt-1 text-sm text-slate-500">{data?.user.email}</p><Button variant="secondary" className="mt-4 w-full" onClick={() => void logout()}><LogOut className="size-4" />ログアウト</Button></Card></div>
    </div>
  </>;
}
