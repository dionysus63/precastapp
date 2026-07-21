/**
 * Opens a same-origin PDF URL and triggers the print dialog.
 *
 * The PDF is fetched first: generation can take several seconds (the
 * draft-invoice batch renders a cover plus every invoice), and printing
 * straight from the API URL raced a fixed fallback timer against the
 * download. A failed response surfaces its error text instead of silently
 * printing nothing.
 *
 * In the desktop shell (Electron), calling print() on a PDF-viewer frame is
 * a silent no-op — Electron never wired up printing for the Chromium PDF
 * plugin. There the pages are rasterized with pdf.js (same pipeline as the
 * in-app PDF previews) into a plain HTML frame, which prints fine. Browsers
 * keep the direct PDF frame for crisp vector output.
 */
export function printPdfUrl(url: string): void {
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
      const blob = await response.blob();

      if ("precastOpsDesktop" in window) {
        try {
          await printBlobAsRasterPages(blob);
          return;
        } catch {
          // Fall through to the PDF-frame path rather than printing nothing.
        }
      }
      printBlobAsPdfFrame(blob);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not print the PDF.",
      );
    }
  })();
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

/** Desktop-shell path: pdf.js rasters each page into an HTML frame. */
async function printBlobAsRasterPages(blob: Blob): Promise<void> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    // 2x = 144 dpi — crisp on paper without megabyte-per-page canvases.
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create a print canvas.");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    pages.push(canvas.toDataURL("image/png"));
  }
  void pdf.cleanup();

  const iframe = attachHiddenIframe();
  const doc = iframe.contentDocument;
  if (!doc) {
    throw new Error("Could not create a print frame.");
  }
  doc.open();
  doc.write(
    "<!doctype html><html><head><style>" +
      "@page{size:letter;margin:0}" +
      "html,body{margin:0;padding:0}" +
      "img{display:block;width:100%;page-break-after:always}" +
      "img:last-child{page-break-after:auto}" +
      "</style></head><body>" +
      pages.map((src) => `<img src="${src}">`).join("") +
      "</body></html>",
  );
  doc.close();

  // Let the data-URL images decode before printing.
  await Promise.all(
    [...doc.images].map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.addEventListener("load", () => resolve());
            img.addEventListener("error", () => resolve());
          }
        }),
    ),
  );

  try {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  } finally {
    cleanupAfterPrint(iframe);
  }
}
