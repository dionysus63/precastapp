export const DEFAULT_PAGE_SIZE = 50;

export type SearchParamValue = string | string[] | undefined;
export type RawSearchParams = Record<string, SearchParamValue>;

export function parseStringParam(value: SearchParamValue): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

export function parsePageParam(value: SearchParamValue): number {
  const parsed = Number.parseInt(parseStringParam(value) || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export type PageInfo = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  skip: number;
  take: number;
  hasPrev: boolean;
  hasNext: boolean;
  /** 1-based index of the first row shown (0 when empty). */
  fromIndex: number;
  /** 1-based index of the last row shown (0 when empty). */
  toIndex: number;
};

export function buildPageInfo(
  total: number,
  requestedPage: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const skip = (page - 1) * pageSize;
  const fromIndex = total === 0 ? 0 : skip + 1;
  const toIndex = Math.min(skip + pageSize, total);

  return {
    total,
    page,
    pageSize,
    totalPages,
    skip,
    take: pageSize,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    fromIndex,
    toIndex,
  };
}
