#!/usr/bin/env tsx
/**
 * Video queue helper — xlsx I/O for /video-queue Claude-driven skill.
 *
 * The /video-queue skill is Claude-driven (because the underlying refine /
 * plan / render steps are Claude skills, not pure TS). This file is just the
 * xlsx read/write helper. The skill calls it via two subcommands:
 *
 *   tsx scripts/video-queue.ts list
 *     → prints JSON [{rowIdx, source, refine, title, notes, status, result, error}]
 *       for every non-blank data row (sorted by rowIdx). Auto-creates a
 *       template at video/input/queue.xlsx if missing.
 *
 *   tsx scripts/video-queue.ts set <rowIdx> <key>=<value> [<key>=<value> ...]
 *     → writes back the named fields for that row. Valid keys: status, result,
 *       error. Status legal values: pending, planned, done, error.
 *
 * Layout (matches /podcast-queue convention):
 *   video/input/queue.xlsx
 *
 * Columns:
 *   source   — path to base .txt source (REQUIRED)
 *   refine   — yes/no (optional) — run /refine-txt before planning
 *   title    — title override (optional) — empty = derive from .txt title line
 *   notes    — free-text user notes (queue ignores; for user organization)
 *   status   — pending (empty) / planned / done / error
 *   result   — output mp4 paths joined `; ` (per-part if auto-split)
 *   error    — error message when status=error
 */
import ExcelJS from "exceljs";
import { existsSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";

const REPO_ROOT = resolvePath(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const QUEUE_XLSX = join(REPO_ROOT, "video", "input", "queue.xlsx");

const COLUMNS = [
  { header: "source", key: "source", width: 50 },
  { header: "refine", key: "refine", width: 8 },
  { header: "title", key: "title", width: 50 },
  { header: "notes", key: "notes", width: 30 },
  { header: "status", key: "status", width: 10 },
  { header: "result", key: "result", width: 60 },
  { header: "error", key: "error", width: 40 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const WRITABLE_KEYS = new Set<ColumnKey>(["source", "refine", "title", "notes", "status", "result", "error"]);
const LEGAL_STATUSES = new Set(["", "pending", "planned", "done", "error"]);

interface RowJson {
  rowIdx: number;
  source: string;
  refine: string;
  title: string;
  notes: string;
  status: string;
  result: string;
  error: string;
}

async function loadOrCreate(): Promise<{ wb: ExcelJS.Workbook; ws: ExcelJS.Worksheet; created: boolean }> {
  const wb = new ExcelJS.Workbook();
  if (existsSync(QUEUE_XLSX)) {
    await wb.xlsx.readFile(QUEUE_XLSX);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error(`queue.xlsx exists but has no worksheet: ${QUEUE_XLSX}`);
    return { wb, ws, created: false };
  }
  const ws = wb.addWorksheet("queue");
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  ws.getRow(1).font = { bold: true };
  await wb.xlsx.writeFile(QUEUE_XLSX);
  return { wb, ws, created: true };
}

function cellString(ws: ExcelJS.Worksheet, headerToCol: Record<string, number>, rowNumber: number, header: string): string {
  const colNumber = headerToCol[header.toLowerCase()];
  if (!colNumber) return "";
  const v = ws.getRow(rowNumber).getCell(colNumber).value;
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && "text" in v) return String((v as { text: string }).text);
  return String(v);
}

function buildHeaderMap(ws: ExcelJS.Worksheet): Record<string, number> {
  const headerToCol: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, colNumber) => {
    const v = cell.value;
    const text = typeof v === "string" ? v : v != null ? String(v) : "";
    if (text) headerToCol[text.trim().toLowerCase()] = colNumber;
  });
  return headerToCol;
}

function ensureColumnPresent(ws: ExcelJS.Worksheet, header: string): number {
  const map = buildHeaderMap(ws);
  const existing = map[header.toLowerCase()];
  if (existing) return existing;
  // Append the missing column on the right.
  const headerRow = ws.getRow(1);
  const newCol = (ws.columnCount || 0) + 1;
  headerRow.getCell(newCol).value = header;
  headerRow.getCell(newCol).font = { bold: true };
  return newCol;
}

async function cmdList(): Promise<void> {
  const { ws, created } = await loadOrCreate();
  if (created) {
    process.stderr.write(`(created empty template at ${QUEUE_XLSX})\n`);
    process.stdout.write("[]\n");
    return;
  }
  const headerToCol = buildHeaderMap(ws);
  const out: RowJson[] = [];
  // Use rowCount (index of last row with values), NOT actualRowCount (count of
  // non-empty rows). They diverge when a row is deleted mid-sheet, leaving a
  // gap — actualRowCount then under-counts and the loop silently drops the
  // trailing rows. (Blank rows inside the range are skipped below via `source`.)
  const lastRow = ws.rowCount;
  for (let rowIdx = 2; rowIdx <= lastRow; rowIdx++) {
    const source = cellString(ws, headerToCol, rowIdx, "source").trim();
    if (!source) continue; // skip blank rows
    out.push({
      rowIdx,
      source,
      refine: cellString(ws, headerToCol, rowIdx, "refine").trim().toLowerCase(),
      title: cellString(ws, headerToCol, rowIdx, "title").trim(),
      notes: cellString(ws, headerToCol, rowIdx, "notes").trim(),
      status: cellString(ws, headerToCol, rowIdx, "status").trim().toLowerCase(),
      result: cellString(ws, headerToCol, rowIdx, "result").trim(),
      error: cellString(ws, headerToCol, rowIdx, "error").trim(),
    });
  }
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

async function cmdSet(rowIdxRaw: string, kvPairs: string[]): Promise<void> {
  const rowIdx = Number.parseInt(rowIdxRaw, 10);
  if (!Number.isInteger(rowIdx) || rowIdx < 2) {
    throw new Error(`rowIdx must be an integer ≥ 2 (header is row 1), got "${rowIdxRaw}"`);
  }
  const updates: Partial<Record<ColumnKey, string>> = {};
  for (const pair of kvPairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx <= 0) throw new Error(`bad key=value pair: "${pair}"`);
    const key = pair.slice(0, eqIdx).trim().toLowerCase() as ColumnKey;
    const value = pair.slice(eqIdx + 1);
    if (!WRITABLE_KEYS.has(key)) {
      throw new Error(`column "${key}" is not writable via this command (writable: ${[...WRITABLE_KEYS].join(", ")})`);
    }
    if (key === "status" && !LEGAL_STATUSES.has(value.trim().toLowerCase())) {
      throw new Error(`illegal status "${value}" (legal: ${[...LEGAL_STATUSES].filter(Boolean).join(", ")})`);
    }
    updates[key] = value;
  }

  const { wb, ws } = await loadOrCreate();
  const lastRow = ws.rowCount; // last row index, not non-empty count (see cmdList)
  if (rowIdx > lastRow + 1) {
    throw new Error(`rowIdx ${rowIdx} is past the last row (${lastRow})`);
  }
  for (const [key, value] of Object.entries(updates)) {
    const colNumber = ensureColumnPresent(ws, key);
    ws.getRow(rowIdx).getCell(colNumber).value = value;
  }
  ws.getRow(rowIdx).commit();
  await wb.xlsx.writeFile(QUEUE_XLSX);
  process.stdout.write(`✓ row ${rowIdx} updated: ${Object.entries(updates).map(([k, v]) => `${k}="${v}"`).join(", ")}\n`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "--help" || cmd === "-h") {
    process.stdout.write(
      "Usage:\n" +
        "  tsx scripts/video-queue.ts list\n" +
        "  tsx scripts/video-queue.ts set <rowIdx> <key>=<value> [<key>=<value> ...]\n" +
        "\nWritable keys: status, result, error\n" +
        "Statuses: pending, planned, done, error\n",
    );
    return;
  }
  if (cmd === "list") {
    await cmdList();
    return;
  }
  if (cmd === "set") {
    const [rowIdx, ...pairs] = rest;
    if (!rowIdx) throw new Error("set: missing <rowIdx> argument");
    await cmdSet(rowIdx, pairs);
    return;
  }
  throw new Error(`unknown command "${cmd}" (use list | set)`);
}

main().catch((err) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
