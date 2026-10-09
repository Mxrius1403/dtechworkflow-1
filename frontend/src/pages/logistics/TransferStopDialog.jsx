import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/common/Bits";
import { Field, NativeSelect } from "@/components/common/Field";
import { useData } from "@/context/DataContext";
import { transferRouteStop } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { DriverOptions } from "./CreateRouteTab";

export function TransferStopDialog({ route, stop, onClose }) {
  const queryClient = useQueryClient();
  const { drivers, byId } = useData();
  const [driverId, setDriverId] = useState(route.driverId);
  const [routeDate, setRouteDate] = useState(route.date);
  const [saving, setSaving] = useState(false);
  const options = drivers.filter((d) => d.active !== false);
  const transfer = async () => {
    const target = byId.drivers[driverId];
    if (!target) return notifyError("Select a driver");
    if (!routeDate) return notifyError("Select a route date");
    if (driverId === route.driverId && routeDate === route.date) {
      return notifyError("Choose a different driver or route date");
    }
    setSaving(true);
    try {
      await transferRouteStop(route.id, stop.id, driverId, routeDate);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Stop moved to ${target.name} • ${routeDate}`);
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not transfer the stop");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="transfer-stop-dialog">
        <DialogHeader>
          <DialogTitle>Move Stop</DialogTitle>
          <DialogDescription><b>{byId.clinics[stop.clinicId]?.name || stop.clinicId}</b> will be moved to the selected driver and route date.</DialogDescription>
        </DialogHeader>
        <Field label="Driver">
          <NativeSelect value={driverId} onChange={(e) => setDriverId(e.target.value)} data-testid="transfer-driver">
            <DriverOptions drivers={options} />
          </NativeSelect>
        </Field>
        <Field label="Route date">
          <Input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} data-testid="transfer-date" />
        </Field>
        <Notice tone="secure">The original tracking link is preserved. If the clinic already received its link, that same link continues to work.</Notice>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid="transfer-cancel">Cancel</Button>
          <Button onClick={transfer} disabled={saving} data-testid="transfer-confirm">{saving ? "Moving…" : "Move Stop"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
