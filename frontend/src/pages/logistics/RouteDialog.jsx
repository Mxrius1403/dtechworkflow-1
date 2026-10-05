import { useState } from "react";
import { MailCheck, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Muted, Notice } from "@/components/common/Bits";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { ACTIVE_ROUTE_STATUSES, emailKey, orderedStops, validDriverPlan } from "@/lib/logistics";
import { demoSave, notify, notifyError } from "@/lib/notify";
import { AddStopDialog } from "./AddStopDialog";
import { RouteStopRow } from "./RouteStopRow";
import { TransferStopDialog } from "./TransferStopDialog";

export function RouteDialog({ route, onClose }) {
  const { byId, emails } = useData();
  const [sub, setSub] = useState(null);
  const plan = byId.routePlans[route.id];
  const planReady = validDriverPlan(route, plan);
  const stops = orderedStops(route, plan, byId.stops);
  const canAdd = ACTIVE_ROUTE_STATUSES.includes(route.status);
  const canDelete = ["published", "cancelled"].includes(route.status);

  if (sub?.type === "add") return <AddStopDialog route={route} planConfirmed={Boolean(plan?.confirmed)} onClose={() => setSub(null)} />;
  if (sub?.type === "transfer") return <TransferStopDialog route={route} stop={sub.stop} onClose={() => setSub(null)} />;

  const sendAll = () => {
    if (!planReady) return notifyError("Wait for the driver to confirm the clinic order first");
    const unsent = stops.filter((s) => byId.clinics[s.clinicId]?.hasEmail && emails[emailKey(route.id, s.id)]?.status !== "sent");
    if (!unsent.length) return notify("All available tracking emails are already sent");
    demoSave(`${unsent.length} tracking email${unsent.length === 1 ? "" : "s"} sent`);
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
        {!planReady && <Notice tone="warn" testId="route-plan-pending">Tracking emails unlock after the driver confirms the clinic order{plan?.confirmed ? " and places every new stop" : ""}.</Notice>}
        <div className="grid gap-2">
          {stops.map((s, i) => <RouteStopRow key={s.id} index={i} route={route} stop={s} planReady={planReady} onTransfer={() => setSub({ type: "transfer", stop: s })} />)}
          {!stops.length && <Muted>No stops.</Muted>}
        </div>
        <p className="text-xs text-muted-foreground">Completed or arrived stops cannot be transferred. Started routes cannot be deleted.</p>
        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          <Button variant="outline" onClick={sendAll} disabled={!planReady} data-testid="route-send-all-emails"><MailCheck /> Send Unsent Tracking Emails</Button>
          <Button onClick={() => setSub({ type: "add" })} disabled={!canAdd} data-testid="route-add-stop"><Plus /> Add Stop</Button>
          <ConfirmAction title="Delete this route?" description="The route is removed and its clinic tracking links are disabled." confirmLabel="Delete Route" onConfirm={() => { demoSave("Route deleted"); onClose(); }} testId="route-delete">
            <Button variant="destructive" disabled={!canDelete} data-testid="route-delete-button"><Trash2 /> Delete Route</Button>
          </ConfirmAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
