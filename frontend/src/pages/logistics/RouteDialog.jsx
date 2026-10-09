import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MailCheck, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Muted, Notice } from "@/components/common/Bits";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { deleteLogisticsRoute, deleteRouteStop } from "@/lib/api";
import { ACTIVE_ROUTE_STATUSES, groupStopsByClinic, orderedStops } from "@/lib/logistics";
import { notify, notifyError } from "@/lib/notify";
import { AddStopDialog } from "./AddStopDialog";
import { RouteStopRow } from "./RouteStopRow";
import { TransferStopDialog } from "./TransferStopDialog";

export function RouteDialog({ route, onClose }) {
  const queryClient = useQueryClient();
  const { byId } = useData();
  const [sub, setSub] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingStopId, setDeletingStopId] = useState(null);
  const plan = byId.routePlans[route.id];
  const stops = orderedStops(route, plan, byId.stops);
  const stopGroups = groupStopsByClinic(stops);
  let stopIndex = 0;
  const numberedStopGroups = stopGroups.map((group) => ({
    ...group,
    stops: group.stops.map((stop) => ({
      stop,
      index: stopIndex++,
    })),
  }));
  const canAdd = ACTIVE_ROUTE_STATUSES.includes(route.status);
  const canDelete = ["published", "cancelled"].includes(route.status);

  if (sub?.type === "add") return <AddStopDialog route={route} planConfirmed={Boolean(plan?.confirmed)} onClose={() => setSub(null)} />;
  if (sub?.type === "transfer") return <TransferStopDialog route={route} stop={sub.stop} onClose={() => setSub(null)} />;

  const removeRoute = async () => {
    setDeleting(true);
    try {
      await deleteLogisticsRoute(route.id);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify("Route deleted");
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not delete the route");
    } finally {
      setDeleting(false);
    }
  };

  const removeStop = async (stop) => {
    setDeletingStopId(stop.id);
    try {
      await deleteRouteStop(route.id, stop.id);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify("Stop deleted");
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not delete the stop");
    } finally {
      setDeletingStopId(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" data-testid="route-dialog">
        <DialogHeader>
          <DialogTitle className="font-mono">{route.id}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            {route.date} • {route.driverId} — {byId.drivers[route.driverId]?.name} <StatusBadge kind="route" value={route.status} />
          </DialogDescription>
        </DialogHeader>
        <Notice tone="warn">Tracking email delivery is not configured on this server. Share a clinic page link to provide live updates.</Notice>
        <div className="grid gap-2">
          {numberedStopGroups.map((group) => (
            <section key={group.clinicId} className="grid gap-2" data-testid={`route-clinic-group-${group.clinicId}`}>
              <h3 className="text-sm font-semibold text-primary">{byId.clinics[group.clinicId]?.name || group.clinicId}</h3>
              {group.stops.map(({ stop, index }) => (
                <RouteStopRow
                  key={stop.id}
                  index={index}
                  route={route}
                  stop={stop}
                  deleting={deletingStopId === stop.id}
                  onTransfer={() => setSub({ type: "transfer", stop })}
                  onDelete={() => removeStop(stop)}
                />
              ))}
            </section>
          ))}
          {!stops.length && <Muted>No stops.</Muted>}
        </div>
        <p className="text-xs text-muted-foreground">Completed or arrived stops cannot be transferred or deleted. Started routes cannot be deleted.</p>
        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          <Button variant="outline" disabled title="Tracking email delivery is not configured. Share the clinic page link instead." data-testid="route-send-all-emails"><MailCheck /> Tracking Emails Unavailable</Button>
          <Button onClick={() => setSub({ type: "add" })} disabled={!canAdd} data-testid="route-add-stop"><Plus /> Add Stop</Button>
          <ConfirmAction title="Delete this route?" description="The route is removed and its clinic tracking links are disabled." confirmLabel="Delete Route" onConfirm={removeRoute} testId="route-delete">
            <Button variant="destructive" disabled={!canDelete || deleting} data-testid="route-delete-button"><Trash2 /> {deleting ? "Deleting…" : "Delete Route"}</Button>
          </ConfirmAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
