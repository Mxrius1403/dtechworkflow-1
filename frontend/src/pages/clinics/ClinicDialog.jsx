import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/common/Bits";
import { Field, NativeSelect } from "@/components/common/Field";
import { createClinic, fetchClinicContact, updateClinic } from "@/lib/api";
import { isEmail } from "@/lib/csv";
import { notify, notifyError } from "@/lib/notify";

const FIELDS = [["name", "Clinic name"], ["address", "Address"], ["eircode", "Eircode"], ["email", "Email (encrypted)"], ["phone", "Phone (encrypted)"], ["contact", "Contact person (encrypted)"]];

function ClinicForm({ id, initial, onClose, clinic }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const save = async () => {
    if (!form.name.trim() || !form.address.trim() || !form.eircode.trim()) return notifyError("Complete clinic name, address and Eircode");
    if (form.email.trim() && !isEmail(form.email.trim())) return notifyError("Clinic email is invalid");
    setSaving(true);
    try {
      const payload = { ...form, active: form.active === "true" };
      if (clinic) await updateClinic(clinic.id, payload);
      else await createClinic(payload);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      await queryClient.invalidateQueries({ queryKey: ["clinic-contact", clinic?.id] });
      notify("Clinic saved");
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not save the clinic");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Clinic ID"><Input value={id} disabled data-testid="clinic-id-input" /></Field>
        {FIELDS.map(([key, label]) => <Field key={key} label={label}><Input value={form[key]} onChange={set(key)} type={key === "email" ? "email" : "text"} data-testid={`clinic-${key}-input`} /></Field>)}
        <Field label="Status">
          <NativeSelect value={form.active} onChange={set("active")} data-testid="clinic-active-input">
            <option value="true">Active</option><option value="false">Inactive</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Private notes (encrypted)"><Textarea rows={3} value={form.notes} onChange={set("notes")} data-testid="clinic-notes-input" /></Field>
      <Notice tone="secure">Private contact details and notes are encrypted at rest and returned only by the manager-only backend endpoint.</Notice>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving} data-testid="clinic-cancel">Cancel</Button>
        <Button onClick={save} disabled={saving} data-testid="clinic-save">{saving ? "Saving…" : "Save Clinic"}</Button>
      </DialogFooter>
    </>
  );
}

/** Add / edit a clinic. Contact fields are loaded separately from routing data. */
export function ClinicDialog({ clinic, onClose }) {
  const contact = useQuery({ queryKey: ["clinic-contact", clinic?.id], queryFn: () => fetchClinicContact(clinic.id), enabled: Boolean(clinic) });
  const id = clinic?.id || "Assigned when saved";
  const secret = contact.data || {};
  const initial = {
    name: clinic?.name || "", address: clinic?.address || "", eircode: clinic?.eircode || "",
    email: secret.email || "", phone: secret.phone || "", contact: secret.contact || "", notes: secret.notes || "",
    active: clinic?.active === false ? "false" : "true",
  };
  if (clinic && contact.isError) {
    const detail = contact.error.response?.data?.detail;
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent data-testid="clinic-dialog">
          <DialogHeader><DialogTitle>Edit Clinic</DialogTitle></DialogHeader>
          <p role="alert" className="text-sm text-destructive">{typeof detail === "string" ? detail : "Could not load clinic contact details."}</p>
          <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => contact.refetch()}>Retry</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="clinic-dialog">
        <DialogHeader><DialogTitle>{clinic ? "Edit Clinic" : "Add Clinic"}</DialogTitle></DialogHeader>
        {clinic && contact.isLoading
          ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-secondary" />
          : <ClinicForm id={id} initial={initial} clinic={clinic} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
