import path from "path";

export const PURCHASE_ORDER_ROOT_DIR = "C:\\PrecastPurchaseOrders";

export function resolvePurchaseOrderDirectory(poNumber: string) {
  return path.join(PURCHASE_ORDER_ROOT_DIR, poNumber);
}

export function resolveVendorQuotePath(poNumber: string, fileName: string) {
  const safeName = path.basename(fileName);
  return path.join(resolvePurchaseOrderDirectory(poNumber), safeName);
}
