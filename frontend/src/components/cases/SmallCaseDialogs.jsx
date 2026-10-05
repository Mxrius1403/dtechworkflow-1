import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, Options } from "@/components/common/Field";
import { NOTE_LIMIT } from "@/config/constants";
import { useData } from "@/context/DataContext";
import { demoSave, notifyError } from "@/lib/notify";

function SimpleDialog({ title, description, children, onClose, onSave, saveLabel = "Save", testId }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid={testId}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid={`${testId}-cancel`}>Cancel</Button>
          <Button onClick={onSave} data-testid={`${testId}-save`}>{saveLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttentionDialog({ c, onClose }) {
  const [status, setStatus] = useState(c.attentionStatus || "active");
  const [note, setNote] = useState(c.attentionNote || "");
  const save = () => {
    demoSave(`Case ${c.code} attention status → ${status.replace("_", " ")}`);
    onClose();
  };
  return (
    <SimpleDialog title={`Case ${c.code} — Attention Status`} onClose={onClose} onSave={save} testId="attention-dialog">
      <Field label="Status">
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} data-testid="attention-status-select">
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="need_information">Need Information</option>
        </NativeSelect>
      </Field>
      <Field label="Note" hint={`${note.length}/${NOTE_LIMIT} characters`}>
        <Textarea maxLength={NOTE_LIMIT} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short reason" data-testid="attention-note-input" />
      </Field>
    </SimpleDialog>
  );
}

export function OverdueReasonDialog({ c, afterComplete, onClose }) {
  const [reason, setReason] = useState(c.overdueReason || "");
  const save = () => {
    if (!reason.trim()) return notifyError("Enter a reason");
    demoSave(afterComplete ? `Overdue reason saved • Case ${c.code} submitted for Manager confirmation` : "Overdue reason saved");
    onClose();
  };
  return (
    <SimpleDialog title={`Overdue justification — Case ${c.code}`} description="Required because this case passed its scheduled production date." onClose={onClose} onSave={save} saveLabel="Save Reason" testId="overdue-reason-dialog">
      <Field label={`Reason (max ${NOTE_LIMIT} characters)`}>
        <Textarea maxLength={NOTE_LIMIT} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why was this case not completed on time?" data-testid="overdue-reason-input" />
      </Field>
    </SimpleDialog>
  );
}

export function AssignTechnicianDialog({ c, onClose }) {
  const { users } = useData();
  const techs = users.filter((u) => u.role === "technician" && u.active);
  const [techId, setTechId] = useState(c.technicianId || "");
  const save = () => {
    const tech = techs.find((t) => t.id === techId);
    if (!tech) return notifyError("Select a technician");
    demoSave(`Case ${c.code} assigned to ${tech.name}`);
    onClose();
  };
  return (
    <SimpleDialog title="Assign Technician" description={`Case ${c.code}`} onClose={onClose} onSave={save} saveLabel="Assign and move to Production" testId="assign-tech-dialog">
      <Field label="Technician">
        <NativeSelect value={techId} onChange={(e) => setTechId(e.target.value)} data-testid="assign-tech-select">
          <option value="">Select technician</option>
          <Options items={techs.map((t) => [t.id, `${t.id} — ${t.name}`])} />
        </NativeSelect>
      </Field>
    </SimpleDialog>
  );
}
