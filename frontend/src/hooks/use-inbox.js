import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/context/SessionContext";
import { fetchInbox } from "@/lib/api";

export const INBOX_QUERY_KEY = ["inbox"];

/** Manager inbox, refreshed every 30 seconds. Other roles get an empty inbox. */
export function useInbox() {
  const { user } = useSession();
  const enabled = Boolean(user?.isManager);
  const query = useQuery({ queryKey: INBOX_QUERY_KEY, queryFn: fetchInbox, enabled, refetchInterval: 30_000 });
  return {
    messages: query.data?.messages || [],
    unread: query.data?.unread || 0,
    loading: enabled && query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
