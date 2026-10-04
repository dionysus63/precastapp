import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, readdirSync } from "fs";
import { unlink, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Silent PDF printing on the server host via the SumatraPDF that
 * pdf-to-printer bundles. Printers and defaults belong to the machine running
 * the app server, so any client on the LAN can print to the shared office
 * printer. Windows-only, like the rest of the deployment.
 *
 * Every external call has a deadline: a wedged spooler or an unreachable LPR
 * queue (LIP-WKS1 off, printer asleep) used to hang the server action forever
 * and leave a SumatraPDF process running as SYSTEM.
 */

/** Long enough for a multi-copy job to spool; a stuck queue is killed. */
const PRINT_TIMEOUT_MS = 90_000;
const PRINTER_LIST_TIMEOUT_MS = 15_000;
/** Printer lists barely change; don't spawn PowerShell on every print. */
const PRINTER_LIST_CACHE_MS = 60_000;

export type ServerPrinter = {
  name: string;
};

let printerListCache: { at: number; printers: ServerPrinter[] } | null = null;

/**
 * Enumerate via PowerShell directly — pdf-to-printer's getPrinters() fails
 * to parse names containing brackets (e.g. "RICOH ... [0026734AF6F6]").
 */
export async function listServerPrinters(): Promise<ServerPrinter[]> {
  if (printerListCache && Date.now() - printerListCache.at < PRINTER_LIST_CACHE_MS) {
    return printerListCache.printers;
  }
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Get-Printer | Select-Object -ExpandProperty Name",
    ],
    { timeout: PRINTER_LIST_TIMEOUT_MS, windowsHide: true },
  );
  const printers = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name }));
  printerListCache = { at: Date.now(), printers };
  return printers;
}

/** The SumatraPDF executable pdf-to-printer ships in its dist folder. */
function findBundledSumatra(): string | null {
  const dist = path.join(process.cwd(), "node_modules", "pdf-to-printer", "dist");
  if (!existsSync(dist)) {
    return null;
  }
  const exe = readdirSync(dist).find((name) => /^SumatraPDF.*\.exe$/i.test(name));
  return exe ? path.join(dist, exe) : null;
}

function isTimeout(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "killed" in error &&
    (error as { killed?: boolean }).killed === true
  );
}

export async function printPdfBytesOnServer(
  pdfBytes: Uint8Array,
  options: { printer: string; monochrome: boolean },
): Promise<void> {
  const tempPath = path.join(os.tmpdir(), `precast-ticket-${randomUUID()}.pdf`);
  await writeFile(tempPath, pdfBytes);
  try {
    const sumatra = findBundledSumatra();
    if (sumatra) {
      // Same arguments pdf-to-printer passes, but with a deadline that kills
      // the process instead of waiting on a stuck queue forever.
      const args = [
        "-print-to",
        options.printer,
        "-silent",
        ...(options.monochrome ? ["-print-settings", "monochrome"] : []),
        tempPath,
      ];
      try {
        await execFileAsync(sumatra, args, {
          timeout: PRINT_TIMEOUT_MS,
          windowsHide: true,
        });
      } catch (error) {
        if (isTimeout(error)) {
          throw new Error(
            `The printer "${options.printer}" didn't accept the job within ${PRINT_TIMEOUT_MS / 1000} seconds — check that it (and the computer sharing it) is on, then try again.`,
          );
        }
        throw error;
      }
      return;
    }

    const { print } = await import("pdf-to-printer");
    await print(tempPath, {
      printer: options.printer,
      ...(options.monochrome ? { monochrome: true } : {}),
    });
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}
