import { AlertTriangle, FileSpreadsheet, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  CONTACT_FIELDS,
  autoMapColumns,
  validateImportRows,
  type ColumnMapping,
  type RawRow,
} from "../../shared/import";
import { useAppData } from "../AppData";
import { postJson } from "../api";
import { parseImportFile } from "../lib/parse-import-file";
import { Badge, Button, Field, Modal, Notice, inputClass } from "./ui";

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { data, refresh } = useAppData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: unknown[]; total: number } | null>(null);

  const checked = useMemo(() => validateImportRows(
    rows,
    mapping,
    data?.contacts.map((contact) => contact.email) ?? [],
    data?.unsubscribes.map((item) => item.email) ?? [],
    data?.contacts.map((contact) => contact.company) ?? [],
    data?.logs.map((log) => log.to_address) ?? [],
  ), [rows, mapping, data]);

  const counts = {
    valid: checked.filter((row) => row.state === "valid").length,
    warning: checked.filter((row) => row.state === "warning").length,
    blocked: checked.filter((row) => row.state === "blocked").length,
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    setError("");
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError("xlsx / xls / csv ファイルを選択してください");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("ファイルサイズは10MB以下にしてください");
      return;
    }
    try {
      const parsed = await parseImportFile(file);
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMapColumns(parsed.headers));
      setResult(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ファイルを読み込めませんでした");
    }
  };

  const runImport = async () => {
    const validRows = checked.filter((row) => row.state !== "blocked").map((row) => ({
      ...row.contact,
      rank: ["A", "B", "C", "D", "OUT"].includes(row.contact.rank) ? row.contact.rank : "OUT",
      status: "未アプローチ",
    }));
    if (!validRows.length) return;
    setBusy(true);
    setError("");
    try {
      const response = await postJson<{ imported: number; skipped: unknown[]; total: number }>("/api/contacts/import", { contacts: validRows });
      setResult(response);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "取込に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return <Modal wide title="Excel / CSVから取込" description="列を項目にマッピングし、重複・形式・配信停止登録を確認します。" onClose={onClose} footer={result ? <Button onClick={onClose}>閉じる</Button> : <><Button variant="secondary" onClick={onClose}>キャンセル</Button><Button busy={busy} disabled={!rows.length || counts.valid + counts.warning === 0} onClick={() => void runImport()}><Upload className="size-4" />送信可能な{counts.valid + counts.warning}件を登録</Button></>}>
    {result ? <div className="space-y-4"><Notice tone="success"><strong>{result.imported}件を登録しました。</strong> サーバー側の再チェックで{result.skipped.length}件を除外しました。</Notice><div className="rounded-xl bg-slate-50 p-8 text-center"><div className="text-4xl font-bold text-emerald-700">{result.imported}</div><div className="mt-2 text-sm text-slate-600">登録件数</div></div></div> : <div className="space-y-6">
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => void loadFile(event.target.files?.[0])} />
      <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void loadFile(event.dataTransfer.files[0]); }} className="flex w-full flex-col items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center hover:border-blue-400 hover:bg-blue-50">
        <FileSpreadsheet className="size-9 text-blue-700" /><span className="mt-3 font-semibold text-slate-900">{fileName || "ファイルをドロップ、またはクリックして選択"}</span><span className="mt-1 text-xs text-slate-500">xlsx / xls / csv、最大10MB。ブラウザ内で解析します。</span>
      </button>
      {error && <Notice tone="danger">{error}</Notice>}
      {rows.length > 0 && <>
        <div><h3 className="font-bold text-slate-900">列マッピング</h3><p className="mt-1 text-xs text-slate-500">Excelの列とアプリの項目を対応させてください。</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{CONTACT_FIELDS.map((field) => <Field key={field.key} label={field.label} required={field.required}><select className={inputClass} value={mapping[field.key] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value || undefined }))}><option value="">割り当てなし</option>{headers.map((header) => <option key={header}>{header}</option>)}</select></Field>)}</div>
        <div className="grid gap-3 sm:grid-cols-4"><div className="rounded-lg bg-slate-100 p-3"><div className="text-2xl font-bold">{checked.length}</div><div className="text-xs text-slate-500">読込済み</div></div><div className="rounded-lg bg-emerald-50 p-3"><div className="text-2xl font-bold text-emerald-700">{counts.valid}</div><div className="text-xs text-emerald-700">正常</div></div><div className="rounded-lg bg-amber-50 p-3"><div className="text-2xl font-bold text-amber-700">{counts.warning}</div><div className="text-xs text-amber-700">警告</div></div><div className="rounded-lg bg-red-50 p-3"><div className="text-2xl font-bold text-red-700">{counts.blocked}</div><div className="text-xs text-red-700">除外</div></div></div>
        {counts.blocked > 0 && <Notice tone="warning"><AlertTriangle className="sr-only" />不正メール、重複、配信停止、必須項目不足は登録しません。</Notice>}
        <div className="max-h-64 overflow-auto rounded-lg border border-slate-200"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="px-3 py-2">行</th><th className="px-3 py-2">会社名</th><th className="px-3 py-2">氏名</th><th className="px-3 py-2">メール</th><th className="px-3 py-2">判定</th><th className="px-3 py-2">理由</th></tr></thead><tbody className="divide-y divide-slate-100">{checked.slice(0, 100).map((row) => <tr key={row.rowNumber}><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2">{row.contact.company}</td><td className="px-3 py-2">{row.contact.name}</td><td className="px-3 py-2">{row.contact.email}</td><td className="px-3 py-2"><Badge tone={row.state === "valid" ? "green" : row.state === "warning" ? "amber" : "red"}>{row.state === "valid" ? "正常" : row.state === "warning" ? "警告" : "除外"}</Badge></td><td className="px-3 py-2 text-slate-500">{row.reasons.join("、") || "—"}</td></tr>)}</tbody></table></div>
      </>}
    </div>}
  </Modal>;
}
