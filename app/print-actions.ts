"use server";

import { cookies, headers } from "next/headers";
import { requireAuth } from "@/lib/auth/session";
import {
  listServerPrinters,
  printPdfBytesOnServer,
} from "@/lib/ticket-printing";

/**
 * Client-driven server printing. The desktop shell cannot print at all
 * (renderer window.print() deadlocks the app on Windows and main-process
 * webContents.print never fires its callback — both reproduced on Electron
 * 35), so shell clients pick one of the SERVER's printers and the server
 * prints the PDF with the same pdf-to-printer pipeline delivery tickets use.
 */

export type ServerPrintResult =
  | { success: true; printer: string }
  | { success: false; error: string };

export async function listPrintersForClient(): Promise<string[]> {
  await requireAuth();
  try {
    const printers = await listServerPrinters();
    return printers.map((printer) => printer.name);
  } catch {
    return [];
  }
}

/**
 * Fetches a same-origin PDF (with the caller's own session cookie, so the
 * route's permission checks still apply) and prints it on a server printer.
 */
export async function printServerPdfForClient(
  pdfPath: string,
  printerName: string,
): Promise<ServerPrintResult> {
  await requireAuth();

  const cleanedPath = pdfPath.trim();
  if (
    !cleanedPath.startsWith("/api/") ||
    cleanedPath.includes("..") ||
    /^[a-z]+:/i.test(cleanedPath)
  ) {
    return { success: false, error: "Invalid print path." };
  }

  const printer = printerName.trim();
  const available = await listServerPrinters().catch(() => []);
  if (!available.some((entry) => entry.name === printer)) {
    return { success: false, error: "That printer is no longer available." };
  }

  try {
    const host = (await headers()).get("host") ?? "localhost:3000";
    const port = host.includes(":") ? host.split(":").pop() : "3000";
    const cookieHeader = (await cookies())
      .getAll()
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    const response = await fetch(`http://127.0.0.1:${port}${cleanedPath}`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("pdf")) {
      const text = (await response.text()).slice(0, 200);
      return {
        success: false,
        error:
          text.trim() ||
          `Could not generate the PDF (HTTP ${response.status}).`,
      };
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    await printPdfBytesOnServer(bytes, { printer, monochrome: false });
    return { success: true, printer };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Printing failed on the server.",
    };
  }
}
