import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, Options } from "@/components/common/Field";
import { NOTE_LIMIT } from "@/config/constants";
import { useData } from "@/context/DataContext";
import { caseDepartment } from "@/lib/cases";
import { notifyError } from "@/lib/notify";

const ATTENTION_LABELS = {
  active: "Active",
  on_hold: "On Hold",
  need_information: "Need Information",
};

export function ReceivingCaseDialog({ c, manager, onClose, onSave, onAttentionSave }) {
  const { users } = useData();
  const technicians = users.filter((user) => user.role === "technician");
  const [department, setDepartment] = useState(caseDepartment(c));
  const [status, setStatus] = useState(c.status);
  const [technicianId, setTechnicianId] = useState(c.technicianId || c.finishedById || "");
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [attentionStatus, setAttentionStatus] = useState(c.attentionStatus || "active");
  const [attentionNote, setAttentionNote] = useState("");
  const [saving, setSaving] = useState(false);

  const saveCase = async () => {
    setSaving(true);
    try {
      const saved = await onSave({
        department: manager ? department : "digital",
        status,
        technicianId,
      });
      if (saved) onClose();
    } finally {
      setSaving(false);
    }
  };

  const saveAttention = async () => {
    if (attentionStatus !== "active" && !attentionNote.trim()) return notifyError("Enter a short reason");
    setSaving(true);
    try {
      const saved = await onAttentionSave({
        attentionStatus,
        attentionNote: attentionNote.trim(),
      });
      if (saved) setAttentionOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (attentionOpen) {
    return (
      <Dialog open onOpenChange={(open) => !open && setAttentionOpen(false)}>
        <DialogContent className="max-w-md" data-testid="receiving-attention-dialog">
          <DialogHeader>
            <DialogTitle>Change Attention Status</DialogTitle>
            <DialogDescription>Case {c.code}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Attention status">
              <NativeSelect
                value={attentionStatus}
                onChange={(event) => {
                  const nextStatus = event.target.value;
                  setAttentionStatus(nextStatus);
                  if (nextStatus === "active") setAttentionNote("");
                }}
                data-testid="receiving-attention-status-select"
              >
                {Object.entries(ATTENTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </Field>
            <Field
              label={`Short reason (${attentionStatus === "active" ? "optional" : "required"})`}
              hint={`${attentionNote.length}/${NOTE_LIMIT} characters`}
            >
              <Textarea
                required={attentionStatus !== "active"}
                maxLength={NOTE_LIMIT}
                value={attentionNote}
                onChange={(event) => setAttentionNote(event.target.value)}
                placeholder="Enter a short reason (optional for Active)"
                data-testid="receiving-attention-reason-input"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttentionOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveAttention} disabled={saving} data-testid="receiving-attention-save">{saving ? "Saving…" : "Save Attention Status"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid={`receiving-case-dialog-${c.code}`}>
        <DialogHeader>
          <DialogTitle className="font-mono">Manage Case {c.code}</DialogTitle>
          <DialogDescription>Update the department, workflow status and responsible technician.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Department">
            <NativeSelect value={manager ? department : "digital"} disabled={!manager} onChange={(event) => setDepartment(event.target.value)} data-testid="receiving-case-department">
              <option value="prosthesis">Prosthesis</option>
              <option value="ortho">Ortho</option>
              <option value="digital">Digital</option>
            </NativeSelect>
          </Field>
          <Field label="Status">
            <NativeSelect value={status} onChange={(event) => setStatus(event.target.value)} data-testid="receiving-case-status">
              <option value="queue">In Queue</option>
              <option value="production">In Production</option>
              <option value="completed">Completed</option>
            </NativeSelect>
          </Field>
          <Field label="Responsible Technician">
            <NativeSelect value={technicianId} onChange={(event) => setTechnicianId(event.target.value)} data-testid="receiving-case-technician">
              <option value="">Unassigned</option>
              <Options items={technicians.map((tech) => [tech.id, `${tech.id} — ${tech.name}${tech.active ? "" : " (Inactive)"}`])} />
            </NativeSelect>
          </Field>
          <div className="rounded-lg border bg-muted/50 p-3 text-sm">
            Attention status: <b>{ATTENTION_LABELS[c.attentionStatus || "active"]}</b>
            {c.attentionNote && <p className="mt-1 text-muted-foreground">{c.attentionNote}</p>}
          </div>
          <Button variant="outline" onClick={() => setAttentionOpen(true)} data-testid="receiving-change-attention">Change Attention Status</Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={saveCase} disabled={saving} data-testid="receiving-case-save">{saving ? "Saving…" : "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
