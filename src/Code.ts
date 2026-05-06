const INVOICE_SHEET_NAME = "SZÁMLÁK";
const SOURCE_ACCOUNT_PROPERTY = "PAYTRACK_HUF_SOURCE_ACCOUNT";
const EXPORT_STATUS = "Rögzíthető";
const EXPORT_CURRENCY = "HUF";
const MAX_ITEMS_PER_FILE = 40;
const CSV_CHARSET = "ISO-8859-2";

const REQUIRED_HEADERS = [
  "Kedvezményezett",
  "Számlaszám",
  "Közlemény",
  "bruttó",
  "pénznem",
  "státusz",
  "utalás napja",
] as const;

const CSV_HEADERS = [
  "Forrás számlaszám",
  "Partner számlaszáma",
  "Partner neve",
  "Átutalandó összeg",
  "Átutalandó deviza",
  "Közlemény",
  "Átutalás egyedi azonosítója",
  "Értéknap",
] as const;

const ALLOWED_TEXT_PATTERN =
  /^[A-Za-z0-9áéíóúöüÁÉÍÓÚÖÜőŐűŰÄßäý \t\r\n,\-.,!?_:()+@;=<>~%*$#&/§]*$/;
const CSV_SAFE_TEXT_PATTERN = /^[^\t\r\n;]*$/;

type RequiredHeader = (typeof REQUIRED_HEADERS)[number];

interface InvoiceTransfer {
  rowNumber: number;
  beneficiaryName: string;
  beneficiaryAccount: string;
  amount: number;
  comment: string;
  valueDate: Date;
  valueDateKey: string;
}

interface ExportFile {
  id: string;
  name: string;
  valueDate: string;
  itemCount: number;
  totalAmount: number;
  transfers: InvoiceTransfer[];
}

interface ValidationError {
  rowNumber: number | null;
  field: string;
  message: string;
}

interface HufTransferExportFileSummary {
  id: string;
  name: string;
  itemCount: number;
  totalAmount: number;
}

interface HufTransferExportDaySummary {
  valueDate: string;
  itemCount: number;
  totalAmount: number;
  files: HufTransferExportFileSummary[];
}

interface HufTransferExportPreview {
  ok: boolean;
  errors: ValidationError[];
  totalItemCount: number;
  totalAmount: number;
  days: HufTransferExportDaySummary[];
}

interface HufTransferExportFileResponse {
  id: string;
  name: string;
  mimeType: string;
  charset: string;
  base64: string;
}

function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu("Számlák")
    .addItem("Forint utalások exportja", "showHufTransferExportSidebar")
    .addToUi();
}

function showHufTransferExportSidebar(): void {
  const html = HtmlService.createHtmlOutputFromFile("HufTransferExportSidebar")
    .setTitle("Forint utalások exportja");

  SpreadsheetApp.getUi().showSidebar(html);
}

function getHufTransferExportPreview(): HufTransferExportPreview {
  const context = collectHufTransferExportContext();

  if (context.errors.length > 0) {
    return {
      ok: false,
      errors: context.errors,
      totalItemCount: 0,
      totalAmount: 0,
      days: [],
    };
  }

  const files = buildExportFiles(context.transfers);
  const days = summarizeExportFiles(files);

  return {
    ok: true,
    errors: [],
    totalItemCount: context.transfers.length,
    totalAmount: sumAmounts(context.transfers),
    days,
  };
}

function getHufTransferExportFile(fileId: string): HufTransferExportFileResponse {
  const context = collectHufTransferExportContext();

  if (context.errors.length > 0) {
    throw new Error("Az export nem generálható, mert az ellenőrzés hibákat talált.");
  }

  const file = buildExportFiles(context.transfers).find((candidate) => candidate.id === fileId);
  if (!file) {
    throw new Error("Nem található exportfájl ehhez az azonosítóhoz: " + fileId);
  }

  const csv = buildHufCsv(context.sourceAccount, file.transfers);
  const blob = Utilities.newBlob("", "text/csv", file.name).setDataFromString(csv, CSV_CHARSET);

  return {
    id: file.id,
    name: file.name,
    mimeType: "text/csv",
    charset: CSV_CHARSET,
    base64: Utilities.base64Encode(blob.getBytes()),
  };
}

function collectHufTransferExportContext(): {
  sourceAccount: string;
  transfers: InvoiceTransfer[];
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const rawSourceAccount =
    PropertiesService.getScriptProperties().getProperty(SOURCE_ACCOUNT_PROPERTY) || "";
  const sourceAccount = normalizeAccount(rawSourceAccount);

  if (!rawSourceAccount.trim()) {
    errors.push({
      rowNumber: null,
      field: SOURCE_ACCOUNT_PROPERTY,
      message: "A HUF forrásszámla nincs beállítva a Script Properties között.",
    });
  } else if (!isValidSourceAccount(sourceAccount)) {
    errors.push({
      rowNumber: null,
      field: SOURCE_ACCOUNT_PROPERTY,
      message: "A HUF forrásszámla csak kötőjel nélküli GIRO vagy IBAN formátumban exportálható.",
    });
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INVOICE_SHEET_NAME);
  if (!sheet) {
    errors.push({
      rowNumber: null,
      field: INVOICE_SHEET_NAME,
      message: "Nem található a SZÁMLÁK munkalap.",
    });
    return { sourceAccount, transfers: [], errors };
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 1) {
    errors.push({
      rowNumber: null,
      field: INVOICE_SHEET_NAME,
      message: "A SZÁMLÁK munkalapon nincs fejlécsor.",
    });
    return { sourceAccount, transfers: [], errors };
  }

  const headerMap = buildHeaderMap(values[0]);
  const missingHeaders = REQUIRED_HEADERS.filter((header) => headerMap[header] === undefined);
  missingHeaders.forEach((header) => {
    errors.push({
      rowNumber: 1,
      field: header,
      message: "Hiányzó kötelező oszlop.",
    });
  });

  if (missingHeaders.length > 0) {
    return { sourceAccount, transfers: [], errors };
  }

  const transfers: InvoiceTransfer[] = [];
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const rowNumber = rowIndex + 1;
    const status = stringValue(row[headerMap.státusz]);

    if (status !== EXPORT_STATUS) {
      continue;
    }

    const rowErrors: ValidationError[] = [];
    const transfer = parseTransferRow(row, rowNumber, headerMap, rowErrors);
    errors.push(...rowErrors);

    if (transfer) {
      transfers.push(transfer);
    }
  }

  return { sourceAccount, transfers, errors };
}

function parseTransferRow(
  row: unknown[],
  rowNumber: number,
  headerMap: Record<RequiredHeader, number>,
  errors: ValidationError[],
): InvoiceTransfer | null {
  const beneficiaryName = stringValue(row[headerMap.Kedvezményezett]);
  const rawAccount = stringValue(row[headerMap.Számlaszám]);
  const beneficiaryAccount = normalizeAccount(rawAccount);
  const comment = stringValue(row[headerMap.Közlemény]);
  const currency = stringValue(row[headerMap.pénznem]);
  const amount = parseAmount(row[headerMap.bruttó]);
  const valueDate = parseDate(row[headerMap["utalás napja"]]);

  validateTextField(beneficiaryName, "Kedvezményezett", 75, rowNumber, true, errors);
  validateTextField(comment, "Közlemény", 140, rowNumber, false, errors);

  if (currency !== EXPORT_CURRENCY) {
    errors.push({
      rowNumber,
      field: "pénznem",
      message: "Csak HUF pénznemű számla exportálható.",
    });
  }

  if (!isValidGiroAccount(beneficiaryAccount)) {
    errors.push({
      rowNumber,
      field: "Számlaszám",
      message: "A kedvezményezett számlaszáma 16 vagy 24 számjegyű GIRO szám lehet.",
    });
  }

  if (amount === null) {
    errors.push({
      rowNumber,
      field: "bruttó",
      message: "A bruttó összeg pozitív egész forintösszeg legyen.",
    });
  }

  if (!valueDate) {
    errors.push({
      rowNumber,
      field: "utalás napja",
      message: "Az utalás napja kötelező dátum.",
    });
  } else if (isPastDate(valueDate)) {
    errors.push({
      rowNumber,
      field: "utalás napja",
      message: "Az utalás napja nem lehet múltbeli dátum.",
    });
  }

  if (errors.some((error) => error.rowNumber === rowNumber)) {
    return null;
  }

  return {
    rowNumber,
    beneficiaryName,
    beneficiaryAccount,
    amount: amount as number,
    comment,
    valueDate: valueDate as Date,
    valueDateKey: formatDateKey(valueDate as Date),
  };
}

function buildHeaderMap(headerRow: unknown[]): Record<RequiredHeader, number> {
  const headerMap = {} as Record<RequiredHeader, number>;

  headerRow.forEach((cell, index) => {
    const header = stringValue(cell);
    if (REQUIRED_HEADERS.includes(header as RequiredHeader)) {
      headerMap[header as RequiredHeader] = index;
    }
  });

  return headerMap;
}

function buildExportFiles(transfers: InvoiceTransfer[]): ExportFile[] {
  const grouped = new Map<string, InvoiceTransfer[]>();

  transfers.forEach((transfer) => {
    const group = grouped.get(transfer.valueDateKey) || [];
    group.push(transfer);
    grouped.set(transfer.valueDateKey, group);
  });

  const files: ExportFile[] = [];
  Array.from(grouped.keys())
    .sort()
    .forEach((valueDateKey) => {
      const dailyTransfers = (grouped.get(valueDateKey) || []).sort(
        (a, b) => a.rowNumber - b.rowNumber,
      );

      for (let start = 0; start < dailyTransfers.length; start += MAX_ITEMS_PER_FILE) {
        const chunk = dailyTransfers.slice(start, start + MAX_ITEMS_PER_FILE);
        const fileIndex = Math.floor(start / MAX_ITEMS_PER_FILE) + 1;
        const fileIndexText = padNumber(fileIndex, 2);
        const id = valueDateKey + "-" + fileIndexText;

        files.push({
          id,
          name: "paytrack-huf-" + valueDateKey + "-" + fileIndexText + ".HUF.CSV",
          valueDate: formatDisplayDate(chunk[0].valueDate),
          itemCount: chunk.length,
          totalAmount: sumAmounts(chunk),
          transfers: chunk,
        });
      }
    });

  return files;
}

function summarizeExportFiles(files: ExportFile[]): HufTransferExportDaySummary[] {
  const summaries = new Map<string, HufTransferExportDaySummary>();

  files.forEach((file) => {
    const summary =
      summaries.get(file.valueDate) ||
      ({
        valueDate: file.valueDate,
        itemCount: 0,
        totalAmount: 0,
        files: [],
      } satisfies HufTransferExportDaySummary);

    summary.itemCount += file.itemCount;
    summary.totalAmount += file.totalAmount;
    summary.files.push({
      id: file.id,
      name: file.name,
      itemCount: file.itemCount,
      totalAmount: file.totalAmount,
    });
    summaries.set(file.valueDate, summary);
  });

  return Array.from(summaries.values()).sort((a, b) => a.valueDate.localeCompare(b.valueDate));
}

function buildHufCsv(sourceAccount: string, transfers: InvoiceTransfer[]): string {
  const rows = [
    CSV_HEADERS.join(";"),
    ...transfers.map((transfer) =>
      [
        sourceAccount,
        transfer.beneficiaryAccount,
        transfer.beneficiaryName,
        String(transfer.amount),
        EXPORT_CURRENCY,
        transfer.comment,
        "",
        formatDisplayDate(transfer.valueDate),
      ].join(";"),
    ),
  ];

  return rows.join("\r\n");
}

function validateTextField(
  value: string,
  field: string,
  maxLength: number,
  rowNumber: number,
  required: boolean,
  errors: ValidationError[],
): void {
  if (required && value.length === 0) {
    errors.push({
      rowNumber,
      field,
      message: "Kötelező mező.",
    });
    return;
  }

  if (value.length > maxLength) {
    errors.push({
      rowNumber,
      field,
      message: "A mező legfeljebb " + maxLength + " karakter lehet.",
    });
  }

  if (!ALLOWED_TEXT_PATTERN.test(value)) {
    errors.push({
      rowNumber,
      field,
      message: "A mező banki importban nem engedett karaktert tartalmaz.",
    });
  }

  if (!CSV_SAFE_TEXT_PATTERN.test(value)) {
    errors.push({
      rowNumber,
      field,
      message: "A mező nem tartalmazhat sortörést, tabulátort vagy pontosvesszőt.",
    });
  }
}

function normalizeAccount(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function isValidGiroAccount(value: string): boolean {
  return /^(\d{16}|\d{24})$/.test(value);
}

function isValidSourceAccount(value: string): boolean {
  return isValidGiroAccount(value) || /^[A-Z]{2}[0-9A-Z]{13,26}$/.test(value);
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  const text = stringValue(value).replace(/\s/g, "");
  if (/^[1-9]\d*$/.test(text)) {
    return Number(text);
  }

  return null;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return stripTime(value);
  }

  const text = stringValue(value);
  const match = text.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})\.?$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return stripTime(date);
}

function isPastDate(value: Date): boolean {
  return value.getTime() < stripTime(new Date()).getTime();
}

function stripTime(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function formatDateKey(value: Date): string {
  return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyyMMdd");
}

function formatDisplayDate(value: Date): string {
  return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy.MM.dd");
}

function padNumber(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function sumAmounts(transfers: InvoiceTransfer[]): number {
  return transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
}
