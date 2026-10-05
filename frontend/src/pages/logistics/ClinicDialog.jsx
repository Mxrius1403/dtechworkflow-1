import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/common/Bits";
import { Field } from "@/components/common/Field";
import { useData } from "@/context/DataContext";
import { fetchClinicContact } from "@/lib/api";
import { isEmail } from "@/lib/csv";
import { demoSave, notifyError } from "@/lib/notify";

const FIELDS = [["name", "Clinic name"], ["address", "Address"], ["eircode", "Eircode"], ["email", "Email (encrypted)"], ["phone", "Phone (encrypted)"], ["contact", "Contact person (encrypted)"]];

function ClinicForm({ id, initial, onClose }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const save = () => {
    if (!form.name.trim() || !form.address.trim() || !form.eircode.trim()) return notifyError("Complete clinic name, address and Eircode");
    if (form.email.trim() && !isEmail(form.email.trim())) return notifyError("Clinic email is invalid");
    demoSave("Clinic saved • critical fields encrypted");
    onClose();
  };
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Clinic ID"><Input value={id} disabled data-testid="clinic-id-input" /></Field>
        {FIELDS.map(([key, label]) => <Field key={key} label={label}><Input value={form[key]} onChange={set(key)} type={key === "email" ? "email" : "text"} data-testid={`clinic-${key}-input`} /></Field>)}
      </div>
      <Field label="Private notes (encrypted)"><Textarea rows={3} value={form.notes} onChange={set("notes")} data-testid="clinic-notes-input" /></Field>
      <Notice tone="secure">Critical contact fields are stored as AES-256-GCM ciphertext by a server function. The encryption key stays only in server environment variables.</Notice>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} data-testid="clinic-cancel">Cancel</Button>
        <Button onClick={save} data-testid="clinic-save">Save Clinic</Button>
      </DialogFooter>
    </>
  );
}

/** Add / edit clinic. Protected contact fields are loaded from their own endpoint, like the original secure function. */
export function ClinicDialog({ clinic, onClose }) {
  const { settings } = useData();
  const contact = useQuery({ queryKey: ["clinic-contact", clinic?.id], queryFn: () => fetchClinicContact(clinic.id), enabled: Boolean(clinic) });
  const id = clinic?.id || `C${String(settings.nextClinicNumber || 1).padStart(4, "0")}`;
  const secret = contact.data || {};
  const initial = {
    name: clinic?.name || "", address: clinic?.address || "", eircode: clinic?.eircode || "",
    email: secret.email || "", phone: secret.phone || "", contact: secret.contact || "", notes: secret.notes || "",
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="clinic-dialog">
        <DialogHeader><DialogTitle>{clinic ? "Edit Clinic" : "Add Clinic"}</DialogTitle></DialogHeader>
        {clinic && contact.isLoading
          ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-secondary" />
          : <ClinicForm id={id} initial={initial} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
