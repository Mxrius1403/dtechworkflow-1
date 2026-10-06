import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/common/Field";
import { isEmail } from "@/lib/csv";
import { createTechnician } from "@/lib/api";
import { demoSave, notify, notifyError } from "@/lib/notify";

const LABEL = { technician: "Technician", manager: "Manager", driver: "Driver" };

/** Add / edit dialog shared by technicians, managers (Owner Control) and drivers. */
export function StaffDialog({ kind, person, nextId, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: person?.name || "", email: person?.email || "", password: "", department: person?.department || "denture", active: person ? String(person.active) : "true" });
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));
  const save = async () => {
    if (!form.name.trim()) return notifyError("Enter a name");
    if (!person && (!isEmail(form.email.trim()) || form.password.length < 12)) {
      return notifyError("Enter a valid email and a temporary password of at least 12 characters");
    }
    if (kind === "technician" && !person) {
      setSaving(true);
      try {
        await createTechnician({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          department: form.department,
        });
        await queryClient.invalidateQueries({ queryKey: ["data"] });
        notify("Technician account created");
        onClose();
      } catch (error) {
        const detail = error.response?.data?.detail;
        notifyError(typeof detail === "string" ? detail : "Could not create technician account");
      } finally {
        setSaving(false);
      }
      return;
    }
    demoSave(`${LABEL[kind]} saved`);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid={`${kind}-dialog`}>
        <DialogHeader><DialogTitle>{person ? "Edit" : "Add"} {LABEL[kind]}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <Field label={`${LABEL[kind]} ID`}><Input value={person?.id || nextId || "Assigned when saved"} disabled data-testid={`${kind}-id-input`} /></Field>
          <Field label="Name"><Input value={form.name} onChange={set("name")} data-testid={`${kind}-name-input`} /></Field>
          {!person && (
            <>
              <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} data-testid={`${kind}-email-input`} /></Field>
              <Field label="Initial password"><Input type="password" value={form.password} onChange={set("password")} placeholder="Minimum 12 characters" data-testid={`${kind}-password-input`} /></Field>
            </>
          )}
          {kind === "technician" ? (
            <Field label="Department">
              <NativeSelect value={form.department} onChange={set("department")} data-testid={`${kind}-department-select`}>
                <option value="denture">Denture</option><option value="ortho">Ortho</option><option value="digital">Digital</option>
              </NativeSelect>
            </Field>
          ) : (
            <Field label="Status">
              <NativeSelect value={form.active} onChange={set("active")} data-testid={`${kind}-active-select`}>
                <option value="true">Active</option><option value="false">Inactive</option>
              </NativeSelect>
            </Field>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid={`${kind}-cancel`}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid={`${kind}-save`}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
