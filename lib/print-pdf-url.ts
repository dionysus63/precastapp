/**
 * Opens a same-origin PDF URL and triggers the browser print dialog.
 *
 * The PDF is fetched first and printed from a blob URL: generation can take
 * several seconds (the draft-invoice batch renders a cover plus every
 * invoice), and printing straight from the API URL raced a fixed fallback
 * timer against the download — slow PDFs "froze" and then never printed.
 * A blob loads instantly once fetched, and a failed response surfaces its
 * error text instead of silently printing nothing.
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

      const blobUrl = URL.createObjectURL(await response.blob());
      const iframe = document.createElement("iframe");
      iframe.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:none";

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
          // Keep the frame (and blob) alive while the print dialog uses it.
          window.setTimeout(() => {
            iframe.remove();
            URL.revokeObjectURL(blobUrl);
          }, 60_000);
        }
      };

      iframe.addEventListener("load", () => {
        window.setTimeout(triggerPrint, 100);
      });
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
      // Blob URLs load near-instantly; this is only insurance against a
      // missed load event.
      window.setTimeout(triggerPrint, 1500);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not print the PDF.",
      );
    }
  })();
}
