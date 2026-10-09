import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/common/Field";
import { useData } from "@/context/DataContext";
import { addRouteStop } from "@/lib/api";
import { isFourDigitCase } from "@/lib/logistics";
import { notify, notifyError } from "@/lib/notify";
import { ClinicOptions } from "./CreateRouteTab";

export function AddStopDialog({ route, planConfirmed, onClose }) {
  const queryClient = useQueryClient();
  const { clinics } = useData();
  const [form, setForm] = useState({ clinicId: "", type: "collection", caseNumber: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const needsCase = form.type !== "collection";
  const save = async () => {
    if (!form.clinicId) return notifyError("Select a clinic");
    if (needsCase && !isFourDigitCase(form.caseNumber)) return notifyError("Delivery case must contain exactly 4 digits");
    setSaving(true);
    try {
      await addRouteStop(route.id, {
        clinicId: form.clinicId,
        type: form.type,
        caseNumber: needsCase ? form.caseNumber.trim() : null,
        notes: form.notes.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(planConfirmed ? "New visit sent to driver for route placement" : "New visit added to the published route");
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not add the stop");
    } finally {
      setSaving(false);
    }
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
              <option value="collection">Collection</option><option value="delivery">Delivery</option>
            </NativeSelect>
          </Field>
          {needsCase && <Field label="Delivery case"><Input value={form.caseNumber} onChange={set("caseNumber")} maxLength={4} inputMode="numeric" placeholder="Required for delivery" data-testid="add-stop-case" /></Field>}
          {form.type !== "delivery" && <Field label="Collection notes"><Input value={form.notes} onChange={set("notes")} placeholder="Operational notes only" data-testid="add-stop-notes" /></Field>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid="add-stop-cancel">Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="add-stop-save">{saving ? "Saving…" : "Send Stop to Driver"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
