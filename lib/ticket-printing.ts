import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Silent PDF printing on the server host via pdf-to-printer (bundled
 * SumatraPDF). Printers and defaults belong to the machine running the app
 * server, so any client on the LAN can print to the shared office printer.
 * Windows-only, like the rest of the deployment.
 */

export type ServerPrinter = {
  name: string;
};

/**
 * Enumerate via PowerShell directly — pdf-to-printer's getPrinters() fails
 * to parse names containing brackets (e.g. "RICOH ... [0026734AF6F6]").
 */
export async function listServerPrinters(): Promise<ServerPrinter[]> {
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Get-Printer | Select-Object -ExpandProperty Name",
  ]);
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name }));
}

export async function printPdfBytesOnServer(
  pdfBytes: Uint8Array,
  options: { printer: string; monochrome: boolean },
): Promise<void> {
  const { print } = await import("pdf-to-printer");
  const tempPath = path.join(os.tmpdir(), `precast-ticket-${randomUUID()}.pdf`);
  await writeFile(tempPath, pdfBytes);
  try {
    await print(tempPath, {
      printer: options.printer,
      ...(options.monochrome ? { monochrome: true } : {}),
    });
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}
