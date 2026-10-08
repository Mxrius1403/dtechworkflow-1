import { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAllData, fetchCases, fetchCatalog } from "@/lib/api";
import { emailKey } from "@/lib/logistics";
import { FullScreenMessage } from "@/components/common/FullScreenMessage";
import { useSession } from "@/context/SessionContext";

const DataContext = createContext(null);
const indexById = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

function shape(data, catalog) {
  const byId = Object.fromEntries(Object.entries(data).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, indexById(v)]));
  const emails = Object.fromEntries(data.trackingEmails.map((e) => [emailKey(e.routeId, e.stopId), e]));
  const techName = (id, fallback = "") => byId.users[id]?.name || fallback;
  return { ...data, byId, emails, techName, catalog: catalog || { materials: [], toothGroups: [] } };
}

/** Loads authenticated collections from /api/data and exposes lists + lookups by id. */
export function DataProvider({ children }) {
  const { signOut } = useSession();
  const data = useQuery({ queryKey: ["data"], queryFn: fetchAllData, refetchOnMount: "always" });
  const cases = useQuery({
    queryKey: ["data", "cases"],
    queryFn: fetchCases,
    enabled: Boolean(data.data),
    refetchInterval: 60_000,
  });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog, staleTime: Infinity });
  const value = useMemo(() => (
    data.data
      ? shape({ ...data.data, cases: cases.data || data.data.cases }, catalog.data)
      : null
  ), [data.data, cases.data, catalog.data]);

  useEffect(() => {
    if (data.error?.response?.status === 401 || cases.error?.response?.status === 401 || catalog.error?.response?.status === 401) signOut();
  }, [data.error, cases.error, catalog.error, signOut]);

  if (data.isError) {
    return <FullScreenMessage title="Data unavailable" text="The server could not be reached. Check the connection and try again." action={{ label: "Retry", onClick: () => data.refetch() }} />;
  }
  if (!value) return <FullScreenMessage title="Dental Tech Daily" text="Loading lab data…" loading />;
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
