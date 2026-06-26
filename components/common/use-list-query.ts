"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * Helpers for list pages that drive their search/filter/sort state through the
 * URL query string so the server can paginate and filter in SQL. Any filter
 * change clears the `page` param so the user returns to page 1.
 */
export function useListQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === "All") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      params.delete("page");
      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return { setParams };
}

/** Debounce a search input into a URL query param via `useListQuery`. */
export function useDebouncedSearchParam(
  paramKey: string,
  committedValue: string,
  delayMs = 350,
) {
  const { setParams } = useListQuery();
  const [search, setSearch] = useState(committedValue);

  useEffect(() => {
    setSearch(committedValue);
  }, [committedValue]);

  useEffect(() => {
    if (search === committedValue) {
      return;
    }
    const handle = setTimeout(() => {
      setParams({ [paramKey]: search });
    }, delayMs);
    return () => clearTimeout(handle);
  }, [search, committedValue, delayMs, paramKey, setParams]);

  return { search, setSearch };
}
