import path from "path";

export const PURCHASE_ORDER_ROOT_DIR = "C:\\PrecastPurchaseOrders";

export function resolvePurchaseOrderDirectory(poNumber: string) {
  return path.join(PURCHASE_ORDER_ROOT_DIR, poNumber);
}

export function resolveVendorQuotePath(poNumber: string, fileName: string) {
  const safeName = path.basename(fileName);
  return path.join(resolvePurchaseOrderDirectory(poNumber), safeName);
}

/**
 * Whether a stored vendor quote path is a file inside a purchase order's own
 * folder under the root, the only place a purchase order may remove a file
 * from. Windows paths, whatever machine checks them.
 */
export function isVendorQuotePathInsideRoot(filePath: string): boolean {
  const root = path.win32.resolve(PURCHASE_ORDER_ROOT_DIR);
  const resolved = path.win32.resolve(filePath);
  const relative = path.win32.relative(root, resolved);
  return (
    relative !== "" &&
    !relative.startsWith("..") &&
    !path.win32.isAbsolute(relative) &&
    // <poNumber>\<file>: never the root itself or a folder directly in it.
    relative.split(path.win32.sep).length === 2
  );
}
