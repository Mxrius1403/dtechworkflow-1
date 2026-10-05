import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/common/Field";
import { useData } from "@/context/DataContext";
import { isFourDigitCase } from "@/lib/logistics";
import { demoSave, notifyError } from "@/lib/notify";
import { ClinicOptions } from "./CreateRouteTab";

export function AddStopDialog({ route, planConfirmed, onClose }) {
  const { clinics } = useData();
  const [form, setForm] = useState({ clinicId: "", type: "collection", caseNumber: "", notes: "" });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const needsCase = form.type !== "collection";
  const save = () => {
    if (!form.clinicId) return notifyError("Select a clinic");
    if (needsCase && !isFourDigitCase(form.caseNumber)) return notifyError("Delivery case must contain exactly 4 digits");
    demoSave(planConfirmed ? "New visit sent to driver for route placement" : "New visit added to the published route");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="add-stop-dialog">
        <DialogHeader>
          <DialogTitle>Add Stop • <span className="font-mono">{route.id}</span></DialogTitle>
          <DialogDescription>The same clinic may be added again. A new visit is always created so earlier completed visits remain unchanged.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Clinic"><NativeSelect value={form.clinicId} onChange={set("clinicId")} data-testid="add-stop-clinic"><option value="">Select clinic</option><ClinicOptions clinics={clinics} /></NativeSelect></Field>
          <Field label="Visit type">
            <NativeSelect value={form.type} onChange={set("type")} data-testid="add-stop-type">
              <option value="collection">Collection</option><option value="delivery">Delivery</option><option value="both">Delivery + Collection</option>
            </NativeSelect>
          </Field>
          {needsCase && <Field label="Delivery case"><Input value={form.caseNumber} onChange={set("caseNumber")} maxLength={4} inputMode="numeric" placeholder="Required for delivery" data-testid="add-stop-case" /></Field>}
          {form.type !== "delivery" && <Field label="Collection notes"><Input value={form.notes} onChange={set("notes")} placeholder="Operational notes only" data-testid="add-stop-notes" /></Field>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="add-stop-cancel">Cancel</Button>
          <Button onClick={save} data-testid="add-stop-save">Send Stop to Driver</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
