import type { RawRow } from "../../shared/import";

type Cell = string | number | boolean | Date | null;

function cellToText(value: Cell | undefined) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (character === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function decodeCsv(buffer: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("shift_jis").decode(buffer).replace(/^\uFEFF/, "");
  }
}

export function gridToRows(grid: Cell[][]) {
  const headers = (grid[0] ?? []).map(cellToText).map((value) => value.trim());
  while (headers.length && !headers.at(-1)) headers.pop();
  if (!headers.length) throw new Error("見出し行が見つかりません");

  const rows = grid.slice(1).filter((values) => values.some((value) => cellToText(value).trim())).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, cellToText(values[index])])) as RawRow,
  );
  if (!rows.length) throw new Error("データ行がありません");
  return { headers: headers.filter(Boolean), rows };
}

export async function parseImportFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") {
    const text = decodeCsv(await file.arrayBuffer());
    return gridToRows(parseCsvText(text));
  }
  if (extension === "xlsx" || extension === "xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: "array",
      cellDates: false,
      cellFormula: false,
      dense: true,
    });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
    if (!sheet) throw new Error("シートが見つかりません");
    const grid = XLSX.utils.sheet_to_json<Cell[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    return gridToRows(grid);
  }
  throw new Error("xlsx / xls / csv ファイルを選択してください");
}
