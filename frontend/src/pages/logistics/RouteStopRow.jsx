import { ArrowRightLeft, ExternalLink, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { ACTIVE_ROUTE_STATUSES, stopJobs, trackingUrl } from "@/lib/logistics";

function EmailButton({ stop }) {
  return (
    <Button size="sm" variant="outline" title="Tracking email delivery is not configured. Share the clinic page link instead." disabled data-testid={`stop-email-${stop.id}`}>
      <Mail /> Email Unavailable
    </Button>
  );
}

export function RouteStopRow({ index, route, stop, deleting, onTransfer, onDelete }) {
  const { byId } = useData();
  const clinic = byId.clinics[stop.clinicId] || {};
  const token = route.trackingTokens?.[stop.id];
  const transferable = !["arrived", "completed"].includes(stop.status) && !stop.arrived;
  const deletable = transferable && ACTIVE_ROUTE_STATUSES.includes(route.status);
  return (
    <div className="rounded-lg border p-3" data-testid={`route-stop-${stop.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-primary">
            <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span> {clinic.name || stop.clinicId}
            {stop.urgent && <StatusBadge kind="flag" value="urgent" />}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {clinic.eircode} • {stopJobs(stop) || "No jobs"} <StatusBadge kind="stop" value={stop.status} testId={`stop-status-${stop.id}`} />
          </p>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <EmailButton stop={stop} />
          <Button size="sm" variant="outline" disabled={!transferable} onClick={onTransfer} data-testid={`stop-transfer-${stop.id}`}><ArrowRightLeft /> Transfer Stop</Button>
          <ConfirmAction
            title="Delete this stop?"
            description={`${clinic.name || stop.clinicId} will be removed from this route and its clinic tracking link will be disabled.`}
            confirmLabel="Delete Stop"
            onConfirm={onDelete}
            testId={`stop-delete-${stop.id}`}
          >
            <Button size="sm" variant="destructive" disabled={!deletable || deleting} data-testid={`stop-delete-button-${stop.id}`}>
              <Trash2 /> {deleting ? "Deleting…" : "Delete Stop"}
            </Button>
          </ConfirmAction>
          {token && (
            <Button asChild size="sm" variant="ghost" data-testid={`stop-tracking-link-${stop.id}`}>
              <a href={trackingUrl(token)} target="_blank" rel="noopener noreferrer"><ExternalLink /> Clinic page</a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
