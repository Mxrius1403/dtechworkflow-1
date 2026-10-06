import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { Field, NativeSelect, Options } from "@/components/common/Field";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { attentionLabel, caseDepartment, scheduledKey, serviceLabel } from "@/lib/cases";
import { localInputValue, nice } from "@/lib/format";
import { demoSave, notifyError } from "@/lib/notify";

const SAVED = { completed: "Case completed by manager", production: "Case moved to production", queue: "Case moved to queue" };

function DetailBox({ c }) {
  return (
    <div className="rounded-lg border bg-muted/50 p-3 text-sm leading-relaxed" data-testid="case-detail-box">
      <p><b>Scheduled:</b> {nice(scheduledKey(c))}</p>
      <p><b>Service:</b> {serviceLabel(c)}</p>
      <p><b>Attention:</b> {attentionLabel(c) || "Active"}{c.attentionNote && ` — ${c.attentionNote}`}</p>
      {c.overdueReason && <p><b>Overdue reason:</b> {c.overdueReason}</p>}
    </div>
  );
}

/** Manager correction dialog: status, department, technician and the real operational time. */
export function CaseControlDialog({ c, onClose, onAttention, onOverdueReason }) {
  const { users, byId } = useData();
  const techs = users.filter((u) => u.role === "technician" && u.active);
  const at = c.status === "completed" ? c.finishedAt : c.status === "production" ? c.startedAt : c.receivedAt;
  const [form, setForm] = useState({ department: caseDepartment(c), status: c.status, techId: c.technicianId || "", at: localInputValue(at), overdue: Boolean(c.overdue) });
  const set = (key) => (e) => setForm({ ...form, [key]: e?.target ? e.target.value : e });

  const save = () => {
    if (!form.at) return notifyError("Choose a valid date and time");
    if (["production", "completed"].includes(form.status) && !byId.users[form.techId]) return notifyError("Select a responsible technician");
    demoSave(SAVED[form.status] || "Case updated");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto" data-testid="case-control-dialog">
        <DialogHeader>
          <DialogTitle className="font-mono">Manage Case {c.code}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">Current status: <StatusBadge kind="case" value={c.status} /></DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department">
            <NativeSelect value={form.department} onChange={set("department")} data-testid="case-department-select">
              <option value="prosthesis">Prosthesis</option><option value="ortho">Ortho</option><option value="digital">Digital</option>
            </NativeSelect>
          </Field>
          <Field label="Status">
            <NativeSelect value={form.status} onChange={set("status")} data-testid="case-status-select">
              <option value="queue">In Queue</option><option value="production">In Production</option><option value="completed">Completed</option>
              {c.status === "removed" && <option value="removed">Removed from Queue</option>}
            </NativeSelect>
          </Field>
          <Field label="Responsible technician" className="sm:col-span-2">
            <NativeSelect value={form.techId} onChange={set("techId")} data-testid="case-tech-select">
              <option value="">Unassigned</option>
              <Options items={techs.map((t) => [t.id, `${t.id} — ${t.name}`])} />
            </NativeSelect>
          </Field>
          <Field label="Operational date and time" hint="Use the real time the case changed status. Reports use this value." className="sm:col-span-2">
            <Input type="datetime-local" value={form.at} onChange={set("at")} data-testid="case-operational-input" />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
            <Checkbox checked={form.overdue} onCheckedChange={set("overdue")} data-testid="case-overdue-checkbox" /> Mark as overdue
          </label>
        </div>
        <DetailBox c={c} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onAttention} data-testid="case-change-attention-button">Change Attention Status</Button>
          {c.overdue && c.technicianId && <Button variant="outline" size="sm" onClick={onOverdueReason} data-testid="case-overdue-reason-button">Overdue Reason</Button>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          {["queue", "production"].includes(c.status) && (
            <ConfirmAction title="Remove this case from the active queue?" description="Its history and reports will be preserved." confirmLabel="Remove" onConfirm={() => { demoSave("Case removed from queue; history preserved"); onClose(); }} testId="case-remove">
              <Button variant="destructive" data-testid="case-remove-button">Remove from Queue</Button>
            </ConfirmAction>
          )}
          <Button variant="outline" onClick={onClose} data-testid="case-control-cancel">Cancel</Button>
          <Button onClick={save} data-testid="case-control-save">Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
