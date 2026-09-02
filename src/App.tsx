import { LoaderCircle, RefreshCw } from "lucide-react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppDataProvider, useAppData } from "./AppData";
import { Layout } from "./components/Layout";
import { Button, Notice } from "./components/ui";
import { AccountsPage } from "./pages/AccountsPage";
import { ComposerPage } from "./pages/ComposerPage";
import { ContactsPage } from "./pages/ContactsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DealsPage } from "./pages/DealsPage";
import { FollowupsPage } from "./pages/FollowupsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { UnsubscribesPage } from "./pages/UnsubscribesPage";

function AppRoutes() {
  const { loading, authenticated, data, error, refresh } = useAppData();
  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-blue-700" /><p className="mt-3 text-sm text-slate-500">Sales Mail Studioを準備しています</p></div></div>;
  if (!authenticated) return <LoginPage />;
  if (!data) return <div className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="max-w-lg"><Notice tone="danger">{error || "D1を読み込めませんでした。ローカルmigrationが適用されているか確認してください。"}</Notice><Button className="mt-4 w-full" onClick={() => void refresh()}><RefreshCw className="size-4" />再読み込み</Button></div></div>;
  return <Layout>{error && <div className="mb-5"><Notice tone="danger">{error}</Notice></div>}<Routes><Route path="/" element={<DashboardPage />} /><Route path="/contacts" element={<ContactsPage />} /><Route path="/compose" element={<ComposerPage />} /><Route path="/campaigns" element={<ComposerPage />} /><Route path="/templates" element={<TemplatesPage />} /><Route path="/followups" element={<FollowupsPage />} /><Route path="/deals" element={<DealsPage />} /><Route path="/history" element={<HistoryPage />} /><Route path="/unsubscribes" element={<UnsubscribesPage />} /><Route path="/accounts" element={<AccountsPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="*" element={<DashboardPage />} /></Routes></Layout>;
}

export default function App() {
  return <BrowserRouter><AppDataProvider><AppRoutes /></AppDataProvider></BrowserRouter>;
}
