import {
  Ban,
  BellRing,
  BriefcaseBusiness,
  FileText,
  Gauge,
  History,
  Mail,
  Menu,
  PenLine,
  Send,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAppData } from "../AppData";

const navigation = [
  { to: "/", label: "ダッシュボード", icon: Gauge },
  { to: "/contacts", label: "営業リスト", icon: Users },
  { to: "/compose", label: "メール作成", icon: PenLine },
  { to: "/campaigns", label: "メール配信", icon: Send },
  { to: "/templates", label: "テンプレート", icon: FileText },
  { to: "/followups", label: "フォロー管理", icon: BellRing },
  { to: "/deals", label: "商談管理", icon: BriefcaseBusiness },
  { to: "/history", label: "配信履歴", icon: History },
  { to: "/unsubscribes", label: "除外リスト", icon: Ban },
  { to: "/accounts", label: "メールアカウント", icon: Mail },
  { to: "/settings", label: "設定", icon: Settings },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useAppData();
  return (
    <div className="flex h-full flex-col bg-slate-950 text-white">
      <div className="flex h-20 items-center gap-3 px-5">
        <div className="grid size-10 place-items-center rounded-xl bg-blue-600 font-black">S</div>
        <div><div className="font-bold tracking-tight">Sales Mail Studio</div><div className="text-[11px] text-slate-400">安全な営業メール運用</div></div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-5">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-900 hover:text-white"}`}
          >
            <Icon className="size-[18px]" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <div className="text-xs text-slate-400">ログイン中</div>
        <div className="mt-1 truncate text-sm font-semibold">{data?.user.displayName}</div>
        <div className="truncate text-xs text-slate-400">{data?.user.email}</div>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><Sidebar /></aside>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-slate-100"><Menu className="size-5" /></button>
        <div className="font-bold text-slate-950">Sales Mail Studio</div><div className="w-9" />
      </header>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} aria-label="メニューを閉じる" />
          <aside className="relative h-full w-72 shadow-2xl"><button className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-300 hover:bg-slate-800" onClick={() => setMobileOpen(false)}><X className="size-5" /></button><Sidebar onNavigate={() => setMobileOpen(false)} /></aside>
        </div>
      )}
      <main className="min-w-0 lg:pl-64"><div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div></main>
    </div>
  );
}
