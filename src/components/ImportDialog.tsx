import { AlertTriangle, FileSpreadsheet } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  CONTACT_FIELDS,
  autoMapColumns,
  validateImportRows,
  type CheckedImportRow,
  type ColumnMapping,
  type RawRow,
} from "../../shared/import";
import type { Contact } from "../../shared/types";
import { useAppData } from "../AppData";
import { parseImportFile } from "../lib/parse-import-file";
import { Badge, Button, Field, Modal, Notice, inputClass } from "./ui";

const MAX_LIST_SIZE = 500;

export interface LoadedSendList {
  fileName: string;
  contacts: Contact[];
}

function checkedRowToContact(row: CheckedImportRow): Contact {
  const value = row.contact;
  const rank = ["A", "B", "C", "D", "OUT"].includes(value.rank) ? value.rank : "OUT";
  return {
    id: crypto.randomUUID(),
    company: value.company,
    department: value.department || null,
    position: value.position || null,
    name: value.name,
    email: value.email,
    phone: value.phone || null,
    industry: value.industry || null,
    area: value.area || null,
    sales_rep: value.sales_rep || null,
    rank,
    status: "未アプローチ",
    issue: value.issue || null,
    service: value.service || null,
    note: value.note || null,
    last_contact_at: null,
    next_followup_at: null,
  };
}

export function ImportDialog({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport?: (list: LoadedSendList) => void;
}) {
  const { data } = useAppData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ loaded: number; excluded: number } | null>(null);

  const checked = useMemo(() => validateImportRows(
    rows,
    mapping,
    [],
    data?.unsubscribes.map((item) => item.email) ?? [],
    [],
    data?.logs.map((log) => log.to_address) ?? [],
  ), [rows, mapping, data]);

  const counts = {
    valid: checked.filter((row) => row.state === "valid").length,
    warning: checked.filter((row) => row.state === "warning").length,
    blocked: checked.filter((row) => row.state === "blocked").length,
  };
  const sendableCount = Math.min(MAX_LIST_SIZE, counts.valid + counts.warning);

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

  const setCurrentList = () => {
    const contacts = checked
      .filter((row) => row.state !== "blocked")
      .slice(0, MAX_LIST_SIZE)
      .map(checkedRowToContact);
    if (!contacts.length) return;
    onImport?.({ fileName, contacts });
    setResult({ loaded: contacts.length, excluded: checked.length - contacts.length });
  };

  return (
    <Modal
      wide
      title="今回の送信リストを読み込む"
      description="Excel / CSVはブラウザ内で解析し、顧客台帳には保存しません。次のファイルを読み込むと置き換わります。"
      onClose={onClose}
      footer={result ? (
        <Button onClick={onClose}>メール作成へ進む</Button>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose}>キャンセル</Button>
          <Button disabled={!rows.length || sendableCount === 0} onClick={setCurrentList}>
            <FileSpreadsheet className="size-4" />
            {sendableCount}件を今回のリストにセット
          </Button>
        </>
      )}
    >
      {result ? (
        <div className="space-y-4">
          <Notice tone="success">
            <strong>{result.loaded}件を今回の送信リストにセットしました。</strong>
            {result.excluded > 0 && <> {result.excluded}件は形式・重複・配信停止・上限により除外しました。</>}
          </Notice>
          <div className="rounded-xl bg-slate-50 p-8 text-center">
            <div className="text-4xl font-bold text-emerald-700">{result.loaded}</div>
            <div className="mt-2 text-sm text-slate-600">今回だけ利用する宛先数</div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => void loadFile(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void loadFile(event.dataTransfer.files[0]);
            }}
            className="flex w-full flex-col items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center hover:border-blue-400 hover:bg-blue-50"
          >
            <FileSpreadsheet className="size-9 text-blue-700" />
            <span className="mt-3 font-semibold text-slate-900">{fileName || "ファイルをドロップ、またはクリックして選択"}</span>
            <span className="mt-1 text-xs text-slate-500">xlsx / xls / csv、最大10MB、1回500件まで</span>
          </button>

          {error && <Notice tone="danger">{error}</Notice>}

          {rows.length > 0 && (
            <>
              <div>
                <h3 className="font-bold text-slate-900">列マッピング</h3>
                <p className="mt-1 text-xs text-slate-500">Excelの列とメール差し込み項目を対応させてください。</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CONTACT_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label} required={field.required}>
                    <select
                      className={inputClass}
                      value={mapping[field.key] ?? ""}
                      onChange={(event) => setMapping((current) => ({
                        ...current,
                        [field.key]: event.target.value || undefined,
                      }))}
                    >
                      <option value="">割り当てなし</option>
                      {headers.map((header) => <option key={header}>{header}</option>)}
                    </select>
                  </Field>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-100 p-3"><div className="text-2xl font-bold">{checked.length}</div><div className="text-xs text-slate-500">読込済み</div></div>
                <div className="rounded-lg bg-emerald-50 p-3"><div className="text-2xl font-bold text-emerald-700">{counts.valid}</div><div className="text-xs text-emerald-700">正常</div></div>
                <div className="rounded-lg bg-amber-50 p-3"><div className="text-2xl font-bold text-amber-700">{counts.warning}</div><div className="text-xs text-amber-700">要確認</div></div>
                <div className="rounded-lg bg-red-50 p-3"><div className="text-2xl font-bold text-red-700">{counts.blocked}</div><div className="text-xs text-red-700">除外</div></div>
              </div>

              {(counts.blocked > 0 || counts.valid + counts.warning > MAX_LIST_SIZE) && (
                <Notice tone="warning">
                  <AlertTriangle className="sr-only" />
                  不正メール、ファイル内重複、配信停止、必須項目不足、501件目以降は今回のリストに含めません。
                </Notice>
              )}

              <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600">
                    <tr><th className="px-3 py-2">行</th><th className="px-3 py-2">会社名</th><th className="px-3 py-2">氏名</th><th className="px-3 py-2">メール</th><th className="px-3 py-2">判定</th><th className="px-3 py-2">理由</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {checked.slice(0, 100).map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2">{row.contact.company}</td>
                        <td className="px-3 py-2">{row.contact.name}</td>
                        <td className="px-3 py-2">{row.contact.email}</td>
                        <td className="px-3 py-2">
                          <Badge tone={row.state === "valid" ? "green" : row.state === "warning" ? "amber" : "red"}>
                            {row.state === "valid" ? "正常" : row.state === "warning" ? "要確認" : "除外"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{row.reasons.join("、") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
