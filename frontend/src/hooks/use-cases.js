import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useData } from "@/context/DataContext";
import { fetchCase, fetchCasePage } from "@/lib/api";

/**
 * One case by id. Active cases come from the shared data; removed ones are fetched on their own.
 * `fallback` (e.g. the clicked table row) is shown while that request runs.
 */
export function useCase(caseId, fallback = null) {
  const { byId } = useData();
  const active = caseId ? byId.cases[caseId] : undefined;
  const query = useQuery({
    queryKey: ["data", "case", caseId],
    queryFn: () => fetchCase(caseId),
    enabled: Boolean(caseId) && !active,
    retry: false,
  });
  const found = active || (caseId && (query.data || fallback)) || null;
  // While a dialog saves or deletes, the case can briefly drop out of every source; keep showing it.
  const lastSeen = useRef(null);
  useEffect(() => {
    if (found || !caseId) lastSeen.current = found;
  });
  const caseItem = found || (caseId && lastSeen.current?.id === caseId ? lastSeen.current : null);
  return { caseItem, error: caseItem ? null : query.error };
}

/** Every case matching `filters` ({ q, technicianId }), newest first, one page at a time from the server. */
export function useCasePages(filters, pageSize = 25) {
  const key = JSON.stringify(filters);
  // The page belongs to the filters it was chosen for, so new filters start on the first page.
  const [paging, setPaging] = useState({ key, page: 0 });
  const page = paging.key === key ? paging.page : 0;
  const query = useQuery({
    queryKey: ["data", "cases", "page", filters, page, pageSize],
    queryFn: () => fetchCasePage({ ...filters, page, pageSize }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.total ?? 0;
  const pageCount = Math.ceil(total / pageSize);

  // A page can run empty when cases disappear (e.g. deleted); step back to the last one.
  useEffect(() => {
    if (!query.isPlaceholderData && page > 0 && page >= pageCount) setPaging({ key, page: Math.max(0, pageCount - 1) });
  }, [query.isPlaceholderData, page, pageCount, key]);

  return {
    rows: query.data?.cases || [],
    total,
    page,
    pageSize,
    setPage: (next) => setPaging({ key, page: next }),
    loading: query.isLoading,
    error: query.error,
  };
}

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
