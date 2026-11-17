/**
 * Minimal, dependency-free CSV helpers.
 * - RFC 4180 quoting (commas, quotes, line breaks).
 * - Neutralises spreadsheet formula injection: cells that start with = + - @ (or tab/CR) are prefixed with a quote,
 *   because player names and notes are user-entered and the file is meant to be opened in Excel.
 * - Output carries a UTF-8 BOM so Excel renders Vietnamese text correctly.
 */

export type CsvCell = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvCell;
}

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(raw: CsvCell): string {
  if (raw === null || raw === undefined) return '';
  let text = typeof raw === 'string' ? raw : String(raw);
  // Plain negative numbers are safe and should stay numeric.
  const isNumber = typeof raw === 'number' && Number.isFinite(raw);
  if (!isNumber && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map(c => escapeCsvCell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map(c => escapeCsvCell(c.value(row))).join(','));
  return lines.join('\r\n') + '\r\n';
}

export const CSV_BOM = '\uFEFF';

/** Triggers a browser download. Browser-only; not covered by unit tests. */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([CSV_BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
