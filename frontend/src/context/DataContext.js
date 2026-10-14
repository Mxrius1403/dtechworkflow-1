import { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAllData, fetchCases, fetchCatalog } from "@/lib/api";
import { FullScreenMessage } from "@/components/common/FullScreenMessage";
import { useSession } from "@/context/SessionContext";
import { useLiveUpdates } from "@/hooks/use-live-updates";
import { SAFETY_REFRESH_INTERVAL } from "@/lib/liveUpdates";

const DataContext = createContext(null);
const indexById = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

function shape(data, catalog) {
  const byId = Object.fromEntries(Object.entries(data).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, indexById(v)]));
  const techName = (id, fallback = "") => byId.users[id]?.name || fallback;
  return { ...data, byId, techName, catalog: catalog || { materials: [], toothGroups: [] } };
}

/** Loads authenticated collections from /api/data, keeps them up to date and exposes lists + lookups by id. */
export function DataProvider({ children }) {
  const { signOut, user } = useSession();
  const liveError = useLiveUpdates();
  const data = useQuery({ queryKey: ["data"], queryFn: fetchAllData, refetchOnMount: "always", refetchInterval: SAFETY_REFRESH_INTERVAL });
  const cases = useQuery({
    queryKey: ["data", "cases"],
    queryFn: fetchCases,
    // Drivers have no access to cases; asking anyway fails and is retried for seconds.
    enabled: Boolean(data.data) && !user?.isDriver,
    refetchInterval: SAFETY_REFRESH_INTERVAL,
  });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog, staleTime: Infinity });
  const value = useMemo(() => (
    data.data
      ? shape({ ...data.data, cases: cases.data || data.data.cases }, catalog.data)
      : null
  ), [data.data, cases.data, catalog.data]);

  useEffect(() => {
    if ([data.error, cases.error, catalog.error, liveError].some((error) => error?.response?.status === 401)) signOut();
  }, [data.error, cases.error, catalog.error, liveError, signOut]);

  // A failed background reload keeps the last data on screen instead of closing the app.
  if (data.isError && !data.data) {
    return <FullScreenMessage title="Data unavailable" text="The server could not be reached. Check the connection and try again." action={{ label: "Retry", onClick: () => data.refetch() }} />;
  }
  if (!value) return <FullScreenMessage title="Dental Tech Daily" text="Loading lab data…" loading />;
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
