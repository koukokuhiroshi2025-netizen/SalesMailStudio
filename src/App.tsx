import { LoaderCircle, LockKeyhole, MailCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { AppDataProvider, useAppData } from "./AppData";
import { Button, Notice } from "./components/ui";
import { BulkMailerPage } from "./pages/BulkMailerPage";

function AppContent() {
  const { loading, authenticated, data, error, refresh } = useAppData();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-center">
          <LoaderCircle className="mx-auto size-8 animate-spin text-blue-700" />
          <p className="mt-3 text-sm text-slate-500">一括メール送信を準備しています</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50">
            <LockKeyhole className="size-7 text-blue-700" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-950">管理者専用リンクが必要です</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            ユーザー登録やパスワード入力はありません。発行済みの管理者専用URLから開くと自動的に利用できます。
          </p>
          {error && <div className="mt-5"><Notice tone="danger">{error}</Notice></div>}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="w-full max-w-lg">
          <Notice tone="danger">{error || "データを読み込めませんでした。"}</Notice>
          <Button className="mt-4 w-full" onClick={() => void refresh()}>
            <RefreshCw className="size-4" />
            再読み込み
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-700 text-white">
              <MailCheck className="size-5" />
            </div>
            <div>
              <div className="font-bold tracking-tight text-slate-950">Sales Mail Studio</div>
              <div className="text-xs text-slate-500">リスト一括メール送信</div>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="size-4" />
            管理者専用
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
        {error && <div className="mb-5"><Notice tone="danger">{error}</Notice></div>}
        <BulkMailerPage />
      </main>
      <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500">
        配信許諾を得た宛先にのみ送信してください。配信停止先は自動除外されます。
      </footer>
    </div>
  );
}

export default function App() {
  return <AppDataProvider><AppContent /></AppDataProvider>;
}
