import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, Options } from "@/components/common/Field";
import { NOTE_LIMIT } from "@/config/constants";
import { useData } from "@/context/DataContext";
import { updateCaseAttention, updateCaseOverdueReason } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";

function SimpleDialog({ title, description, children, onClose, onSave, saveLabel = "Save", saving = false, testId }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid={testId}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid={`${testId}-cancel`}>Cancel</Button>
          <Button onClick={onSave} disabled={saving} data-testid={`${testId}-save`}>{saveLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttentionDialog({ c, onClose }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(c.attentionStatus || "active");
  const [note, setNote] = useState(c.attentionNote || "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    if (status !== "active" && !note.trim()) return notifyError("Enter a short reason");
    setSaving(true);
    try {
      await updateCaseAttention(c.id, {
        attentionStatus: status,
        attentionNote: note.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Case ${c.code} updated`);
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not update the case");
    } finally {
      setSaving(false);
    }
  };
  return (
    <SimpleDialog title={`Case ${c.code} — Attention Status`} onClose={onClose} onSave={save} saveLabel={saving ? "Saving…" : "Save Attention Status"} saving={saving} testId="attention-dialog">
      <Field label="Attention status">
        <NativeSelect value={status} onChange={(event) => {
          const nextStatus = event.target.value;
          setStatus(nextStatus);
          if (nextStatus === "active") setNote("");
        }} data-testid="attention-status-select">
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="need_information">Need Information</option>
        </NativeSelect>
      </Field>
      <Field label={`Short reason (${status === "active" ? "optional" : "required"})`} hint={`${note.length}/${NOTE_LIMIT} characters`}>
        <Textarea required={status !== "active"} maxLength={NOTE_LIMIT} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Enter a short reason (optional for Active)" data-testid="attention-note-input" />
      </Field>
    </SimpleDialog>
  );
}

export function OverdueReasonDialog({ c, onClose }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState(c.overdueReason || "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    if (!reason.trim()) return notifyError("Enter a reason");
    setSaving(true);
    try {
      await updateCaseOverdueReason(c.id, reason.trim());
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Overdue reason saved for case ${c.code}`);
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not save the overdue reason");
    } finally {
      setSaving(false);
    }
  };
  return (
    <SimpleDialog title={`Overdue justification — Case ${c.code}`} description="Required because this case passed its scheduled production date." onClose={onClose} onSave={save} saveLabel={saving ? "Saving…" : "Save Reason"} saving={saving} testId="overdue-reason-dialog">
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
    notifyError(`Assigning case ${c.code} to ${tech.name} is not connected to server storage.`);
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
