import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Notice } from "@/components/common/Bits";
import { Field, NativeSelect } from "@/components/common/Field";
import { useData } from "@/context/DataContext";
import { demoSave, notifyError } from "@/lib/notify";
import { DriverOptions } from "./CreateRouteTab";

export function TransferStopDialog({ route, stop, onClose }) {
  const { drivers, byId } = useData();
  const [driverId, setDriverId] = useState("");
  const options = drivers.filter((d) => d.active !== false && d.id !== route.driverId);
  const transfer = () => {
    const target = byId.drivers[driverId];
    if (!target) return notifyError("Select a driver");
    demoSave(`Stop transferred to ${target.name}`);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="transfer-stop-dialog">
        <DialogHeader>
          <DialogTitle>Transfer Stop</DialogTitle>
          <DialogDescription><b>{byId.clinics[stop.clinicId]?.name || stop.clinicId}</b> will be removed from {route.driverId} and assigned to another driver.</DialogDescription>
        </DialogHeader>
        <Field label="New driver">
          <NativeSelect value={driverId} onChange={(e) => setDriverId(e.target.value)} data-testid="transfer-driver">
            <option value="">Select driver</option>
            <DriverOptions drivers={options} />
          </NativeSelect>
        </Field>
        <Notice tone="secure">The original tracking link is preserved. If the clinic already received its link, that same link continues to work.</Notice>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="transfer-cancel">Cancel</Button>
          <Button onClick={transfer} data-testid="transfer-confirm">Transfer Destination</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
