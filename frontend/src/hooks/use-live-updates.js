import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { INBOX_QUERY_KEY } from "@/hooks/use-inbox";
import { SERVICE_TYPES_KEY } from "@/hooks/use-service-types";
import { fetchChanges, hasPendingWrites } from "@/lib/api";
import { changedAreas, LIVE_UPDATE_INTERVAL } from "@/lib/liveUpdates";

// What to reload when the server reports a change in an area.
const QUERIES_BY_AREA = {
  data: [["data"], ["case-history"], ["managers"]],
  cases: [["data", "cases"], ["data", "case"], ["case-history"]],
  inbox: [INBOX_QUERY_KEY],
  products: [["products"]],
  serviceTypes: [SERVICE_TYPES_KEY],
};

/**
 * Asks the server every few seconds, and whenever the tab comes back into view, what has
 * changed, then reloads only that. Returns the request error so a lost sign-in can be handled.
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  const seen = useRef(null);
  const { data, dataUpdatedAt, error } = useQuery({
    queryKey: ["changes"],
    queryFn: fetchChanges,
    staleTime: 0,
    refetchInterval: LIVE_UPDATE_INTERVAL,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!data) return;
    // A reload now could undo a change the screen shows before it is saved; look again next time.
    if (seen.current && hasPendingWrites()) return;
    const areas = changedAreas(seen.current, data);
    seen.current = data;
    areas
      .flatMap((area) => QUERIES_BY_AREA[area] || QUERIES_BY_AREA.data)
      .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  }, [data, dataUpdatedAt, queryClient]);

  return error;
}
