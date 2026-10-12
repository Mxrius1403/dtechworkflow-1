import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/common/Field";
import { useData } from "@/context/DataContext";
import { reassignUnfinishedStops } from "@/lib/api";
import { addDays } from "@/lib/format";
import { notify, notifyError } from "@/lib/notify";
import { DriverOptions } from "./CreateRouteTab";

export function ReassignUnfinishedDialog({ route, count, onClose }) {
  const queryClient = useQueryClient();
  const { drivers, byId } = useData();
  const [driverId, setDriverId] = useState(route.driverId);
  const [routeDate, setRouteDate] = useState(addDays(route.date, 1));
  const [saving, setSaving] = useState(false);
  const options = drivers.filter((d) => d.active !== false);
  const submit = async () => {
    if (!byId.drivers[driverId]) return notifyError("Select a driver");
    if (!routeDate) return notifyError("Select a route date");
    setSaving(true);
    try {
      await reassignUnfinishedStops(route.id, driverId, routeDate);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`${count} stop(s) assigned to ${byId.drivers[driverId].name} • ${routeDate}`);
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not reassign the stops");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="reassign-dialog">
        <DialogHeader>
          <DialogTitle>Reassign Unfinished Stops</DialogTitle>
          <DialogDescription>{count} unfinished stop(s) will be moved to a new route.</DialogDescription>
        </DialogHeader>
        <Field label="Driver">
          <NativeSelect value={driverId} onChange={(e) => setDriverId(e.target.value)} data-testid="reassign-driver">
            <DriverOptions drivers={options} />
          </NativeSelect>
        </Field>
        <Field label="Route date">
          <Input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} data-testid="reassign-date" />
        </Field>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} data-testid="reassign-confirm">{saving ? "Assigning…" : "Assign to New Route"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
