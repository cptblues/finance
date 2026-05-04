import Papa from "papaparse";
import { z } from "zod";
import type { CsvSource, ImportError, ImportRecord, ImportSummary, Transaction } from "./types";

export const expectedColumns = [
  "Date de comptabilisation",
  "Libelle simplifie",
  "Libelle operation",
  "Reference",
  "Informations complementaires",
  "Type operation",
  "Categorie",
  "Sous categorie",
  "Debit",
  "Credit",
  "Date operation",
  "Date de valeur",
  "Pointage operation"
] as const;

export const tradeRepublicExpectedColumns = [
  "datetime",
  "date",
  "account_type",
  "category",
  "type",
  "asset_class",
  "name",
  "symbol",
  "shares",
  "price",
  "amount",
  "fee",
  "tax",
  "currency",
  "original_amount",
  "original_currency",
  "fx_rate",
  "description",
  "transaction_id",
  "counterparty_name",
  "counterparty_iban",
  "payment_reference",
  "mcc_code"
] as const;

const csvRowSchema = z.record(z.string(), z.string().optional());

export function cleanText(value?: string | null): string {
  return (value ?? "")
    .replace(/NÂ°/g, "N°")
    .replace(/nÂ°/g, "n°")
    .replace(/Â°/g, "°")
    .replace(/N�/g, "N°")
    .replace(/n�/g, "n°")
    .replace(/�/g, "°");
}

export function parseFrenchAmount(value?: string | null): number {
  if (!value) return 0;

  const trimmed = value.trim();
  const isParenthesizedNegative = /^\(.*\)$/.test(trimmed);
  const isTrailingNegative = /-$/.test(trimmed);
  const normalized = trimmed
    .replace(/[()\s\u00a0\u202f]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/-$/, "")
    .trim();
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) return 0;

  return isParenthesizedNegative || isTrailingNegative ? -Math.abs(amount) : amount;
}

export function hasAmount(value?: string | null): boolean {
  return Boolean(value?.trim());
}

export function computeSignedAmount(debit: number, credit: number, hasDebit: boolean, hasCredit: boolean): number {
  if (!hasDebit && !hasCredit) return 0;
  if (hasDebit && hasCredit) return debit + credit;
  if (hasDebit) return debit;
  return credit;
}

export function normalizeFrenchDate(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function normalizeIsoDate(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return trimmed;

  const datePrefix = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
  if (datePrefix) return `${datePrefix[1]}-${datePrefix[2]}-${datePrefix[3]}`;

  return null;
}

function clean(value?: string | null): string | null {
  const trimmed = cleanText(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createFingerprint(row: Record<string, string>): Promise<string> {
  return sha256(
    [
      row["Date operation"],
      row["Libelle operation"],
      row["Reference"],
      row["Debit"],
      row["Credit"]
    ].join("|")
  );
}

export async function createTradeRepublicFingerprint(row: Record<string, string>): Promise<string> {
  return sha256(
    [
      row["datetime"],
      row["date"],
      row["transaction_id"],
      row["amount"],
      row["fee"],
      row["tax"],
      row["currency"],
      row["type"],
      row["name"],
      row["symbol"]
    ].join("|")
  );
}

export async function fileHash(content: string): Promise<string> {
  return sha256(content);
}

export function validateColumns(fields: string[] | undefined, columns: readonly string[] = expectedColumns): string[] {
  const present = new Set(fields ?? []);
  return columns.filter((column) => !present.has(column));
}

export async function normalizeCsvRow(row: Record<string, string>, now = new Date().toISOString()): Promise<Transaction> {
  const cleanedRow = cleanRow(row);
  const parsed = csvRowSchema.parse(cleanedRow);
  const debit = parseFrenchAmount(parsed["Debit"]);
  const credit = parseFrenchAmount(parsed["Credit"]);
  const amount = computeSignedAmount(debit, credit, hasAmount(parsed["Debit"]), hasAmount(parsed["Credit"]));
  const operationDate = normalizeFrenchDate(parsed["Date operation"]);
  const bookingDate = normalizeFrenchDate(parsed["Date de comptabilisation"]);
  const valueDate = normalizeFrenchDate(parsed["Date de valeur"]);
  const fingerprint = await createFingerprint(cleanedRow);

  return {
    id: fingerprint,
    source: "caisse-epargne",
    fingerprint,
    date: operationDate ?? bookingDate ?? valueDate,
    bookingDate,
    operationDate,
    valueDate,
    label: clean(parsed["Libelle simplifie"]) ?? clean(parsed["Libelle operation"]) ?? "Transaction sans libelle",
    rawLabel: clean(parsed["Libelle operation"]),
    reference: clean(parsed["Reference"]),
    notes: clean(parsed["Informations complementaires"]),
    operationType: clean(parsed["Type operation"]),
    bankCategory: clean(parsed["Categorie"]),
    bankSubcategory: clean(parsed["Sous categorie"]),
    userCategory: null,
    userNotes: null,
    debit,
    credit,
    amount,
    isChecked: clean(parsed["Pointage operation"]) === "Oui",
    isExcludedFromStats: false,
    recurrenceId: null,
    recurrenceStatus: null,
    raw: cleanedRow,
    createdAt: now,
    updatedAt: now
  };
}

export async function normalizeTradeRepublicCsvRow(row: Record<string, string>, now = new Date().toISOString()): Promise<Transaction> {
  const cleanedRow = cleanRow(row);
  const parsed = csvRowSchema.parse(cleanedRow);
  const amount = parseFrenchAmount(parsed["amount"]);
  const date = normalizeIsoDate(parsed["date"]) ?? normalizeIsoDate(parsed["datetime"]);
  const fingerprint = await createTradeRepublicFingerprint(cleanedRow);
  const rawLabel = [clean(parsed["type"]), clean(parsed["name"]), clean(parsed["symbol"]), clean(parsed["description"])]
    .filter(Boolean)
    .join(" - ");

  return {
    id: fingerprint,
    source: "trade-republic",
    fingerprint,
    date,
    bookingDate: date,
    operationDate: date,
    valueDate: null,
    label:
      clean(parsed["description"]) ??
      clean(parsed["name"]) ??
      clean(parsed["counterparty_name"]) ??
      clean(parsed["type"]) ??
      "Transaction Trade Republic",
    rawLabel: rawLabel || null,
    reference: clean(parsed["transaction_id"]) ?? clean(parsed["payment_reference"]),
    notes: clean(parsed["counterparty_name"]),
    operationType: clean(parsed["type"]),
    bankCategory: clean(parsed["category"]) ?? clean(parsed["account_type"]) ?? "Trade Republic",
    bankSubcategory: clean(parsed["asset_class"]) ?? clean(parsed["currency"]),
    userCategory: null,
    userNotes: null,
    debit: amount < 0 ? amount : 0,
    credit: amount > 0 ? amount : 0,
    amount,
    isChecked: false,
    isExcludedFromStats: false,
    recurrenceId: null,
    recurrenceStatus: null,
    raw: cleanedRow,
    createdAt: now,
    updatedAt: now
  };
}

function cleanRow(row: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [cleanText(key).trim(), cleanText(value)]));
}

function getPeriod(transactions: Transaction[]) {
  const dates = transactions.map((transaction) => transaction.date).filter(Boolean).sort() as string[];
  return {
    periodStart: dates[0] ?? null,
    periodEnd: dates[dates.length - 1] ?? null
  };
}

export async function parseCaisseEpargneCsv(
  content: string,
  fileName: string,
  existingFingerprints = new Set<string>()
): Promise<ImportSummary> {
  const parsed = parseCsv(content, ";");

  return parseRows({
    source: "caisse-epargne",
    fileName,
    content,
    parsed,
    expected: expectedColumns,
    existingFingerprints,
    normalizeRow: normalizeCsvRow
  });
}

export async function parseTradeRepublicCsv(
  content: string,
  fileName: string,
  existingFingerprints = new Set<string>()
): Promise<ImportSummary> {
  const parsed = parseCsv(content, detectDelimiter(content));

  return parseRows({
    source: "trade-republic",
    fileName,
    content,
    parsed,
    expected: tradeRepublicExpectedColumns,
    existingFingerprints,
    normalizeRow: normalizeTradeRepublicCsvRow
  });
}

export async function parseBankCsv(
  content: string,
  fileName: string,
  source: CsvSource,
  existingFingerprints = new Set<string>()
): Promise<ImportSummary> {
  return source === "trade-republic"
    ? parseTradeRepublicCsv(content, fileName, existingFingerprints)
    : parseCaisseEpargneCsv(content, fileName, existingFingerprints);
}

function parseCsv(content: string, delimiter: string) {
  return Papa.parse<Record<string, string>>(content, {
    header: true,
    delimiter,
    skipEmptyLines: "greedy",
    transformHeader: (header) => cleanText(header).trim(),
    transform: (value) => cleanText(value).trim()
  });
}

function detectDelimiter(content: string) {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const candidates = ["\t", ";", ","];
  return candidates
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ",";
}

async function parseRows({
  source,
  fileName,
  content,
  parsed,
  expected,
  existingFingerprints,
  normalizeRow
}: {
  source: CsvSource;
  fileName: string;
  content: string;
  parsed: Papa.ParseResult<Record<string, string>>;
  expected: readonly string[];
  existingFingerprints: Set<string>;
  normalizeRow: (row: Record<string, string>, now: string) => Promise<Transaction>;
}): Promise<ImportSummary> {
  const missingColumns = validateColumns(parsed.meta.fields, expected);
  const errors: ImportError[] = parsed.errors.map((error) => ({
    rowNumber: error.row ?? 0,
    message: error.message,
    raw: {}
  }));

  if (missingColumns.length > 0) {
    const importRecord = await buildImportRecord(source, fileName, content, [], [], parsed.data.length, errors.length);
    return { importRecord, transactions: [], duplicates: [], errors, missingColumns };
  }

  const seen = new Set(existingFingerprints);
  const transactions: Transaction[] = [];
  const duplicates: Transaction[] = [];
  const now = new Date().toISOString();

  for (let index = 0; index < parsed.data.length; index += 1) {
    const row = parsed.data[index];
    try {
      const transaction = await normalizeRow(row, now);
      if (seen.has(transaction.fingerprint)) {
        duplicates.push(transaction);
        continue;
      }
      seen.add(transaction.fingerprint);
      transactions.push(transaction);
    } catch (error) {
      errors.push({
        rowNumber: index + 2,
        message: error instanceof Error ? error.message : "Ligne invalide",
        raw: row
      });
    }
  }

  const importRecord = await buildImportRecord(source, fileName, content, transactions, duplicates, parsed.data.length, errors.length);
  return { importRecord, transactions, duplicates, errors, missingColumns };
}

async function buildImportRecord(
  source: CsvSource,
  fileName: string,
  content: string,
  transactions: Transaction[],
  duplicates: Transaction[],
  rowsCount: number,
  errorRowsCount: number
): Promise<ImportRecord> {
  const now = new Date().toISOString();
  const period = getPeriod([...transactions, ...duplicates]);

  return {
    id: await fileHash(`${fileName}|${content}|${now}`),
    source,
    fileName,
    fileHash: await fileHash(content),
    rowsCount,
    validRowsCount: transactions.length,
    duplicateRowsCount: duplicates.length,
    errorRowsCount,
    totalDebit: transactions.reduce((sum, transaction) => sum + (transaction.amount < 0 ? Math.abs(transaction.amount) : 0), 0),
    totalCredit: transactions.reduce((sum, transaction) => sum + (transaction.amount > 0 ? transaction.amount : 0), 0),
    ...period,
    createdAt: now
  };
}
