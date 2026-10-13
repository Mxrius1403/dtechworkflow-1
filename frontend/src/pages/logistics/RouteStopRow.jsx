import { AlertTriangle, ArrowRightLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { ACTIVE_ROUTE_STATUSES, stopJobs } from "@/lib/logistics";

export function RouteStopRow({ index, route, stop, deleting, onTransfer, onDelete, onCheck, onReportProblem, checkDisabled = false, readOnly = false }) {
  const { byId } = useData();
  const clinic = byId.clinics[stop.clinicId] || {};
  const transferable = !["arrived", "completed"].includes(stop.status) && !stop.arrived;
  const deletable = transferable && ACTIVE_ROUTE_STATUSES.includes(route.status);
  const problem = stop.status !== "completed" && stop.problem;
  return (
    <div className="rounded-lg border p-3" data-testid={`route-stop-${stop.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {onCheck && (
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-primary"
            checked={stop.status === "completed"}
            disabled={checkDisabled}
            onChange={(event) => onCheck(event.target.checked)}
            aria-label={`Mark stop ${index + 1} as done`}
            data-testid={`stop-check-${stop.id}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-primary">
            <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span> {stopJobs(stop) || "No jobs"}
            {stop.urgent && <StatusBadge kind="flag" value="urgent" />}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {clinic.eircode} <StatusBadge kind="stop" value={stop.status} testId={`stop-status-${stop.id}`} />
          </p>
          {problem && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900" data-testid={`stop-problem-${stop.id}`}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {problem.label}
            </p>
          )}
        </div>
        {onReportProblem && stop.status !== "completed" && (
          <Button size="sm" variant="outline" className="ml-auto" disabled={checkDisabled} onClick={onReportProblem} data-testid={`stop-report-problem-${stop.id}`}>
            <AlertTriangle /> {problem ? "Update problem" : "Report problem"}
          </Button>
        )}
        {!readOnly && <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" disabled={!transferable} onClick={onTransfer} data-testid={`stop-transfer-${stop.id}`}><ArrowRightLeft /> Transfer Stop</Button>
          <ConfirmAction
            title="Delete this stop?"
            description={`${clinic.name || stop.clinicId} will be removed from this route.`}
            confirmLabel="Delete Stop"
            confirmIcon={<Trash2 />}
            destructiveConfirm
            onConfirm={onDelete}
            testId={`stop-delete-${stop.id}`}
          >
            <Button size="sm" variant="destructive" disabled={!deletable || deleting} data-testid={`stop-delete-button-${stop.id}`}>
              <Trash2 /> {deleting ? "Deleting…" : "Delete Stop"}
            </Button>
          </ConfirmAction>
        </div>}
      </div>
    </div>
  );
}
