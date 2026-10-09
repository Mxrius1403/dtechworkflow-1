import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/common/Field";
import { useData } from "@/context/DataContext";
import { addRouteStop } from "@/lib/api";
import { isRouteCaseCode, unroutedCases } from "@/lib/logistics";
import { departmentName } from "@/lib/cases";
import { cn } from "@/lib/utils";
import { notify, notifyError } from "@/lib/notify";
import { ClinicOptions } from "./CreateRouteTab";

export function AddStopDialog({ route, planConfirmed, onClose }) {
  const queryClient = useQueryClient();
  const { clinics, cases, stops, byId } = useData();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ clinicId: "", type: "collection", caseNumber: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value, ...(key === "type" ? { caseNumber: "" } : {}) });
  const needsCase = form.type !== "collection";
  const deliverable = useMemo(
    () => unroutedCases(cases, stops, byId.routes, ["completed"])
      .filter((c) => (c.deliveryStatus || "not_delivered") === "not_delivered" && isRouteCaseCode(c.code)),
    [cases, stops, byId.routes],
  );
  const shown = deliverable.filter((c) => !search || String(c.code).toLowerCase().includes(search.toLowerCase()));
  const save = async () => {
    if (!form.clinicId) return notifyError("Select a clinic");
    if (needsCase && !isRouteCaseCode(form.caseNumber)) return notifyError("Select a case to deliver");
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
          {needsCase && (
            <Field label="Delivery case">
              <div className="grid gap-2" data-testid="add-stop-case-picker">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search completed cases" data-testid="add-stop-case-search" />
                <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200" role="listbox" aria-label="Completed cases not yet delivered">
                  {shown.length === 0 ? <p className="p-3 text-sm text-slate-500">No completed, undelivered cases available.</p> : shown.map((c) => {
                    const code = String(c.code).trim();
                    const active = form.caseNumber === code;
                    return (
                      <button key={c.id} type="button" role="option" aria-selected={active} onClick={() => setForm({ ...form, caseNumber: code })} data-testid={`add-stop-case-${code}`}
                        className={cn("flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50", active && "bg-teal-50")}>
                        <span className="font-mono font-bold">{code}</span>
                        <span className="text-xs text-slate-500">{departmentName(c.department)}</span>
                      </button>
                    );
                  })}
                </div>
                {form.caseNumber && <p className="text-xs text-slate-600">Selected case: <span className="font-mono font-bold">{form.caseNumber}</span></p>}
              </div>
            </Field>
          )}
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
