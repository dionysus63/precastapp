/**
 * Opens a same-origin PDF URL and triggers the browser print dialog.
 * Uses a hidden iframe because inline PDF responses often do not fire `load`
 * on a window opened with window.open().
 */
export function printPdfUrl(url: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:none";
  iframe.src = url;
  document.body.appendChild(iframe);

  let printed = false;

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 2000);
  };

  const triggerPrint = () => {
    if (printed) {
      return;
    }
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      cleanup();
    }
  };

  iframe.addEventListener("load", () => {
    window.setTimeout(triggerPrint, 300);
  });
  window.setTimeout(triggerPrint, 2000);
}
