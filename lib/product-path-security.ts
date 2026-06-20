import { assertPathUnderRoot } from "@/lib/job-path-security";

export function assertPathUnderStockSubmittalsRoot(
  stockSubmittalsRoot: string,
  targetPath: string,
) {
  assertPathUnderRoot(stockSubmittalsRoot, targetPath);
}
