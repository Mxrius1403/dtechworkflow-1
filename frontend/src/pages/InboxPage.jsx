import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCheck, CheckCircle2, Info, Mail, MailOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCaseDialogs } from "@/components/cases/CaseDialogsProvider";
import { Muted } from "@/components/common/Bits";
import { Panel } from "@/components/common/Panel";
import { CountPill } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { INBOX_QUERY_KEY, useInbox } from "@/hooks/use-inbox";
import { deleteInboxMessage, markAllInboxRead, setInboxMessageRead } from "@/lib/api";
import { dateTimeOf } from "@/lib/format";
import { inboxDestination, inboxTargetLabel, unreadMessages } from "@/lib/inbox";
import { notify, notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";

const FILTERS = [["all", "All"], ["unread", "Unread"]];
const SEVERITY = {
  info: { icon: Info, edge: "border-l-sky-500", tone: "text-sky-600" },
  success: { icon: CheckCircle2, edge: "border-l-emerald-500", tone: "text-emerald-600" },
  warning: { icon: AlertTriangle, edge: "border-l-amber-500", tone: "text-amber-600" },
};

export default function InboxPage() {
  const { messages, unread, loading, error } = useInbox();
  const { byId } = useData();
  const { openCase } = useCaseDialogs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const rows = filter === "unread" ? unreadMessages(messages) : messages;
  const refresh = () => queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY });

  const run = async (request, failure) => {
    try {
      await request();
      await refresh();
      return true;
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : failure);
      return false;
    }
  };

  const setRead = (message, read) => run(() => setInboxMessageRead(message.id, read), "Could not update the message");
  const remove = async (message) => {
    if (await run(() => deleteInboxMessage(message.id), "Could not delete the message")) notify("Message deleted");
  };
  const readAll = async () => {
    if (await run(markAllInboxRead, "Could not mark messages as read")) notify("All messages marked as read");
  };

  const open = (message) => {
    if (!message.read) setRead(message, true);
    const destination = inboxDestination(message, byId);
    if (!destination) return notifyError(`This ${inboxTargetLabel(message)} is no longer available.`);
    if (destination.caseId) return openCase(destination.caseId);
    return navigate(destination.path);
  };

  return (
    <Panel
      title={<span className="flex items-center gap-2">Inbox <CountPill testId="inbox-unread-count">{unread}</CountPill></span>}
      description="New events from the lab. Click a message to open it."
      actions={(
        <>
          <div className="flex rounded-lg border p-0.5" role="tablist">
            {FILTERS.map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={cn("rounded-md px-3 py-1 text-sm font-medium", filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary")}
                data-testid={`inbox-filter-${key}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={readAll} disabled={!unread} data-testid="inbox-read-all"><CheckCheck /> Mark all as read</Button>
        </>
      )}
      data-testid="inbox-panel"
    >
      <div className="grid gap-2">
        {rows.map((m) => {
          const severity = SEVERITY[m.severity] || SEVERITY.info;
          const Icon = severity.icon;
          return (
            <div
              key={m.id}
              className={cn(
                "flex flex-wrap items-start justify-between gap-3 rounded-lg border border-l-4 p-3 transition-colors",
                severity.edge,
                m.read ? "bg-card opacity-80" : "bg-primary/5",
              )}
              data-testid={`inbox-message-${m.id}`}
            >
              <button type="button" onClick={() => open(m)} className="flex min-w-0 flex-1 gap-2.5 text-left" data-testid={`inbox-open-${m.id}`}>
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", severity.tone)} aria-hidden />
                <span className="min-w-0">
                  <span className={cn("flex items-center gap-2 text-sm text-primary", !m.read && "font-bold")}>
                    {m.title}
                    {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </span>
                  {m.body && <span className="mt-0.5 block text-sm text-foreground">{m.body}</span>}
                  <span className="mt-1 block text-xs text-muted-foreground">{m.by && `${m.by} • `}{dateTimeOf(m.createdAt)}</span>
                </span>
              </button>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setRead(m, !m.read)} data-testid={`inbox-toggle-read-${m.id}`}>
                  {m.read ? <><Mail /> Mark unread</> : <><MailOpen /> Mark read</>}
                </Button>
                <Button size="sm" variant="outline" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => remove(m)} aria-label="Delete message" data-testid={`inbox-delete-${m.id}`}><Trash2 /></Button>
              </div>
            </div>
          );
        })}
        {loading && <Muted>Loading messages…</Muted>}
        {error && !loading && <Muted>Messages could not be loaded. Check your connection.</Muted>}
        {!rows.length && !loading && !error && <Muted>{filter === "unread" ? "No unread messages." : "Your inbox is empty."}</Muted>}
      </div>
    </Panel>
  );
}
