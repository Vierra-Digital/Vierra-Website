/**
 * Prefix a cell that starts with =, +, -, @, tab, or CR with a single quote so Excel/Google
 * Sheets render it as text rather than executing it as a formula (CSV/spreadsheet-injection
 * guard). Shared by the CSV and XLSX exporters so the guard can't drift between them.
 */
export function guardSpreadsheetFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
