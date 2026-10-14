import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/context/SessionContext";
import { fetchInbox } from "@/lib/api";
import { SAFETY_REFRESH_INTERVAL } from "@/lib/liveUpdates";

export const INBOX_QUERY_KEY = ["inbox"];

/** Manager inbox, reloaded as soon as live updates report a new message. Other roles get an empty inbox. */
export function useInbox() {
  const { user } = useSession();
  const enabled = Boolean(user?.isManager);
  const query = useQuery({ queryKey: INBOX_QUERY_KEY, queryFn: fetchInbox, enabled, refetchInterval: SAFETY_REFRESH_INTERVAL });
  return {
    messages: query.data?.messages || [],
    unread: query.data?.unread || 0,
    loading: enabled && query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
