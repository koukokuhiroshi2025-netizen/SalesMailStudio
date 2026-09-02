import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAppData } from "../AppData";
import { Button, Field, Notice, inputClass } from "../components/ui";

export function LoginPage() {
  const { login } = useAppData();
  const [email, setEmail] = useState("sales@example.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { await login(email, password); } catch (cause) { setError(cause instanceof Error ? cause.message : "ログインできませんでした"); } finally { setBusy(false); } };
  return <div className="grid min-h-screen bg-slate-950 lg:grid-cols-[1.1fr_0.9fr]">
    <div className="hidden flex-col justify-between bg-[radial-gradient(circle_at_top_left,_#1d4ed8,_#0f172a_58%)] p-12 text-white lg:flex"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-white/15 text-xl font-black">S</div><span className="text-lg font-bold">Sales Mail Studio</span></div><div className="max-w-xl"><p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">From list to follow-up</p><h1 className="mt-5 text-5xl font-bold leading-tight">営業メールを、<br />安全で続く仕組みに。</h1><p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">Excelの営業リストから個別メール、Garoon下書き、配信履歴、次回フォローまでを一つの画面で管理します。</p></div><div className="flex gap-6 text-xs text-slate-400"><span>個別送信</span><span>誤送信防止</span><span>D1監査ログ</span><span>Garoon連携</span></div></div>
    <div className="flex items-center justify-center bg-slate-50 p-6 sm:p-10"><div className="w-full max-w-md"><div className="mb-8 lg:hidden"><div className="text-xl font-bold text-slate-950">Sales Mail Studio</div><div className="mt-1 text-sm text-slate-500">安全な営業メール運用</div></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5 sm:p-8"><div className="grid size-11 place-items-center rounded-xl bg-blue-50"><LockKeyhole className="size-5 text-blue-700" /></div><h2 className="mt-5 text-2xl font-bold text-slate-950">ログイン</h2><p className="mt-2 text-sm text-slate-500">管理者から案内されたメールアドレスとパスワードを入力してください。</p><form className="mt-7 space-y-5" onSubmit={submit}><Field label="メールアドレス" required><div className="relative"><Mail className="absolute left-3 top-2.5 size-5 text-slate-400" /><input type="email" autoComplete="username" className={`${inputClass} pl-10`} value={email} onChange={(event) => setEmail(event.target.value)} /></div></Field><Field label="パスワード" required><input type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} /></Field>{error && <Notice tone="danger">{error}</Notice>}<Button type="submit" busy={busy} disabled={!email || !password} className="w-full">ログイン</Button></form><div className="mt-6 flex gap-3 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />認証CookieはHttpOnlyで保護され、メール接続パスワードをブラウザには保存しません。</div></div></div></div>
  </div>;
}
