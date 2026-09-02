import { CheckCircle2, KeyRound, Mail, PlugZap, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppData } from "../AppData";
import { postJson } from "../api";
import { Badge, Button, Card, Field, Notice, PageHeader, inputClass, statusTone } from "../components/ui";
import { formatDate } from "../format";

export function AccountsPage() {
  const { data, refresh } = useAppData();
  const account = useMemo(() => data?.mailAccounts.find((item) => item.provider === "garoon"), [data]);
  const [displayName, setDisplayName] = useState(account?.display_name ?? "Garoon営業メール");
  const [email, setEmail] = useState(account?.email ?? "");
  const [baseUrl, setBaseUrl] = useState(account?.base_url ?? "");
  const [accountId, setAccountId] = useState(account?.account_id ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [basicUsername, setBasicUsername] = useState("");
  const [basicPassword, setBasicPassword] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [message, setMessage] = useState("");
  const save = async () => { setBusy("save"); setMessage(""); try { await postJson("/api/mail-accounts", { displayName, email, baseUrl, accountId }); await refresh(); setMessage("公開設定を保存しました。認証情報は保存していません。"); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "保存に失敗しました"); } finally { setBusy(null); } };
  const test = async () => { setBusy("test"); setMessage(""); try { const result = await postJson<{ success: boolean; message: string }>("/api/mail/test-connection", { baseUrl, accountId, username, password, basicUsername: basicUsername || undefined, basicPassword: basicPassword || undefined }); setMessage(result.message); await refresh(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "接続に失敗しました"); } finally { setBusy(null); } };
  return <>
    <PageHeader title="メールアカウント" description="送信元アカウントとGaroon接続を管理します。" />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3"><Mail className="size-6 text-blue-700" /></div><div><h2 className="font-bold text-slate-950">Garoon SOAP API</h2><p className="text-sm text-slate-500">クラウド版Garoon・プレーンテキスト</p></div></div><Badge tone={statusTone(account?.status ?? "unverified")}>{account?.status ?? "未確認"}</Badge></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="表示名" required><input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></Field><Field label="送信元メール"><input type="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field label="Garoon URL" hint="例: https://example.cybozu.com/" required><input className={inputClass} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></Field><Field label="メールアカウントID" required><input className={inputClass} value={accountId} onChange={(event) => setAccountId(event.target.value)} /></Field></div>
        <div className="my-6 border-t border-slate-200" /><div className="flex items-center gap-2"><KeyRound className="size-5 text-slate-500" /><h3 className="font-bold text-slate-900">接続テスト専用の認証情報</h3></div><p className="mt-1 text-xs text-slate-500">入力値は接続テストの1リクエストにのみ使用し、D1・localStorageには保存しません。</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2"><Field label="ログイン名" required><input autoComplete="username" className={inputClass} value={username} onChange={(event) => setUsername(event.target.value)} /></Field><Field label="パスワード" required><input type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} /></Field><Field label="Basic認証ユーザー（任意）"><input className={inputClass} value={basicUsername} onChange={(event) => setBasicUsername(event.target.value)} /></Field><Field label="Basic認証パスワード（任意）"><input type="password" className={inputClass} value={basicPassword} onChange={(event) => setBasicPassword(event.target.value)} /></Field></div>
        {message && <div className="mt-5"><Notice tone={message.includes("接続しました") || message.includes("保存しました") ? "success" : "danger"}>{message}</Notice></div>}
        <div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="secondary" busy={busy === "save"} disabled={!baseUrl || !accountId} onClick={() => void save()}><Save className="size-4" />公開設定を保存</Button><Button busy={busy === "test"} disabled={!baseUrl || !accountId || !username || !password} onClick={() => void test()}><PlugZap className="size-4" />接続テスト</Button></div>
      </Card>
      <div className="space-y-5"><Notice tone="warning"><strong>本番送信にはWorker Secretsが必要です。</strong><br />画面入力したパスワードは保存されないため、READMEの手順で <code>wrangler secret put</code> を実行してください。</Notice><Card className="p-5"><h3 className="font-bold text-slate-900">接続仕様</h3><ul className="mt-4 space-y-3 text-sm text-slate-600">{["SOAP 1.2 / WSDL 1.1","MailSendMails / MailSaveDraftMails","WS-Security認証","クラウド版 *.cybozu.com のみ"].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />{item}</li>)}</ul>{account?.last_tested_at && <p className="mt-5 border-t border-slate-200 pt-4 text-xs text-slate-500">最終接続テスト: {formatDate(account.last_tested_at, true)}</p>}</Card></div>
    </div>
  </>;
}
