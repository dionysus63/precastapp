import {
  listPrintersForClient,
  printServerPdfForClient,
} from "@/app/print-actions";

/**
 * Prints a same-origin PDF URL.
 *
 * Browsers: fetch the PDF and print it from a hidden PDF-viewer frame
 * (crisp vector output through the normal print dialog).
 *
 * Desktop shell (Electron): the shell cannot print AT ALL — renderer
 * window.print() deadlocks the whole app on Windows the moment the system
 * dialog is confirmed, and main-process webContents.print never fires its
 * callback (both reproduced on Electron 35). Instead the app shows its own
 * picker of the SERVER's printers and the server prints the PDF with the
 * same pdf-to-printer pipeline used for delivery tickets.
 */
export function printPdfUrl(url: string): void {
  if ("precastOpsDesktop" in window) {
    void printViaServerWithPicker(url);
    return;
  }

  void (async () => {
    try {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("pdf")) {
        const text = (await response.text()).slice(0, 300);
        window.alert(
          text.trim() || `Could not generate the PDF (HTTP ${response.status}).`,
        );
        return;
      }
      printBlobAsPdfFrame(await response.blob());
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not print the PDF.",
      );
    }
  })();
}

const LAST_PRINTER_KEY = "precast:last-print-printer";

async function printViaServerWithPicker(url: string): Promise<void> {
  let printers: string[] = [];
  try {
    printers = await listPrintersForClient();
  } catch {
    printers = [];
  }
  if (printers.length === 0) {
    window.alert("No printers are available on the server.");
    return;
  }

  let remembered: string | null = null;
  try {
    remembered = localStorage.getItem(LAST_PRINTER_KEY);
  } catch {
    // Storage unavailable; the first printer is preselected.
  }

  const printer = await pickPrinter(printers, remembered);
  if (!printer) {
    return;
  }
  try {
    localStorage.setItem(LAST_PRINTER_KEY, printer);
  } catch {
    // Best effort only.
  }

  const result = await printServerPdfForClient(url, printer);
  if (!result.success) {
    window.alert(result.error);
  }
}

/** Minimal in-app printer picker (the shell has no usable native dialog). */
function pickPrinter(
  printers: string[],
  preselect: string | null,
): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;" +
      "justify-content:center;background:rgba(15,23,42,0.45)";

    const card = document.createElement("div");
    card.style.cssText =
      "background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.25);" +
      "padding:20px;width:340px;max-width:90vw;font-family:inherit";

    const title = document.createElement("p");
    title.textContent = "Print";
    title.style.cssText =
      "margin:0 0 4px;font-size:15px;font-weight:600;color:#0f172a";

    const hint = document.createElement("p");
    hint.textContent = "Prints from the office server to the printer you pick.";
    hint.style.cssText = "margin:0 0 12px;font-size:12px;color:#64748b";

    const select = document.createElement("select");
    select.style.cssText =
      "width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;" +
      "font-size:13px;color:#0f172a;background:#fff";
    for (const name of printers) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    }
    if (preselect && printers.includes(preselect)) {
      select.value = preselect;
    }

    const buttons = document.createElement("div");
    buttons.style.cssText =
      "display:flex;justify-content:flex-end;gap:8px;margin-top:16px";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.style.cssText =
      "padding:7px 14px;border:1px solid #cbd5e1;border-radius:8px;" +
      "background:#fff;font-size:13px;font-weight:600;color:#334155;cursor:pointer";

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.textContent = "Print";
    confirm.style.cssText =
      "padding:7px 16px;border:none;border-radius:8px;background:#0f172a;" +
      "font-size:13px;font-weight:600;color:#fff;cursor:pointer";

    const close = (value: string | null) => {
      overlay.remove();
      resolve(value);
    };
    cancel.addEventListener("click", () => close(null));
    confirm.addEventListener("click", () => close(select.value || null));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close(null);
      }
    });

    buttons.append(cancel, confirm);
    card.append(title, hint, select, buttons);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    select.focus();
  });
}

function attachHiddenIframe(): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:none";
  document.body.appendChild(iframe);
  return iframe;
}

/** Keep the frame (and any blob URL) alive while the print dialog uses it. */
function cleanupAfterPrint(iframe: HTMLIFrameElement, blobUrl?: string): void {
  window.setTimeout(() => {
    iframe.remove();
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
  }, 60_000);
}

/** Browser path: the PDF renders in the frame and prints as vectors. */
function printBlobAsPdfFrame(blob: Blob): void {
  const blobUrl = URL.createObjectURL(blob);
  const iframe = attachHiddenIframe();

  let printed = false;
  const triggerPrint = () => {
    if (printed) {
      return;
    }
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      cleanupAfterPrint(iframe, blobUrl);
    }
  };

  iframe.addEventListener("load", () => {
    window.setTimeout(triggerPrint, 100);
  });
  iframe.src = blobUrl;
  // Blob URLs load near-instantly; this is only insurance against a missed
  // load event.
  window.setTimeout(triggerPrint, 1500);
}
