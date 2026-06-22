import * as XLSX from "xlsx";

export function buildExportFilename(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${date}.xlsx`;
}

export function buildWorkbookBuffer(
  headers: string[],
  rows: unknown[][],
): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Export");
  return Buffer.from(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  );
}

export function excelResponse(buffer: Buffer, filename: string): Response {
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function formatExportDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function formatYesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function formatOptionalDecimal(
  value: { toString(): string } | null | undefined,
): number | string {
  if (value === null || value === undefined) {
    return "";
  }

  const parsed = Number.parseFloat(value.toString());
  return Number.isFinite(parsed) ? parsed : value.toString();
}

export function formatOptionalString(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export { formatExportDate };
