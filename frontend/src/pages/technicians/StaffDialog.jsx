import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/common/Field";
import { isEmail } from "@/lib/csv";
import { createDriver, createManager, createTechnician, updateDriver, updateManager, updateTechnician } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";

const LABEL = { technician: "Technician", manager: "Manager", driver: "Driver" };

/** Add / edit dialog shared by technicians, managers (Owner Control) and drivers. */
export function StaffDialog({ kind, person, nextId, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: person?.name || "", email: person?.email || "", password: "", active: person ? String(person.active) : "true" });
  const [saving, setSaving] = useState(false);
  const [openRoutes, setOpenRoutes] = useState(null);
  const needsLogin = true;
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));
  const saveDriver = async (force) => {
    setSaving(true);
    try {
      const details = {
        name: form.name.trim(),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        active: form.active === "true",
        ...(form.password ? { password: form.password } : {}),
      };
      if (person) await updateDriver(person.id, details, force);
      else await createDriver(details);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Driver ${person ? "saved" : "account created"}`);
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail?.code === "driver_has_routes") setOpenRoutes(detail.routes);
      else notifyError(typeof detail === "string" ? detail : "Could not save driver");
    } finally {
      setSaving(false);
    }
  };
  const save = async () => {
    if (!form.name.trim()) return notifyError("Enter a name");
    if (needsLogin && !(kind === "driver" && person && !form.email.trim()) && !isEmail(form.email.trim())) {
      return notifyError("Enter a valid email address");
    }
    if (needsLogin && !person && form.password.length < 12) {
      return notifyError("Enter a valid email and a temporary password of at least 12 characters");
    }
    if (person && form.password && form.password.length < 12) {
      return notifyError("New password must be at least 12 characters");
    }
    if (kind === "driver") {
      await saveDriver(false);
      return;
    }
    if ((kind === "technician" || kind === "manager") && person) {
      setSaving(true);
      try {
        const updateAccount = kind === "manager" ? updateManager : updateTechnician;
        await updateAccount(person.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          ...(form.password ? { password: form.password } : {}),
        });
        await queryClient.invalidateQueries({ queryKey: [kind === "manager" ? "managers" : "data"] });
        notify(`${LABEL[kind]} saved`);
        onClose();
      } catch (error) {
        const detail = error.response?.data?.detail;
        notifyError(typeof detail === "string" ? detail : `Could not save ${kind}`);
      } finally {
        setSaving(false);
      }
      return;
    }
    if ((kind === "technician" || kind === "manager") && !person) {
      setSaving(true);
      try {
        const createAccount = kind === "manager" ? createManager : createTechnician;
        const details = {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        };
        await createAccount(details);
        if (kind === "technician") {
          await queryClient.invalidateQueries({ queryKey: ["data"] });
        } else {
          await queryClient.invalidateQueries({ queryKey: ["managers"] });
        }
        notify(`${LABEL[kind]} account created`);
        onClose();
      } catch (error) {
        const detail = error.response?.data?.detail;
        notifyError(typeof detail === "string" ? detail : `Could not create ${kind} account`);
      } finally {
        setSaving(false);
      }
      return;
    }
    notifyError(`Saving ${kind} accounts is not supported.`);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid={`${kind}-dialog`}>
        <DialogHeader><DialogTitle>{person ? "Edit" : "Add"} {LABEL[kind]}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <Field label={`${LABEL[kind]} ID`}><Input value={person?.id || nextId || "Assigned when saved"} disabled data-testid={`${kind}-id-input`} /></Field>
          <Field label="Name"><Input value={form.name} onChange={set("name")} data-testid={`${kind}-name-input`} /></Field>
          {needsLogin && (
            <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} data-testid={`${kind}-email-input`} /></Field>
          )}
          {needsLogin && (
            <>
              <Field label={person ? "New password" : "Initial password"}><Input type="password" value={form.password} onChange={set("password")} placeholder={person ? "Leave blank to keep current password" : "Minimum 12 characters"} data-testid={`${kind}-password-input`} /></Field>
            </>
          )}
          {kind === "driver" ? (
            <Field label="Status">
              <NativeSelect value={form.active} onChange={set("active")} data-testid={`${kind}-active-select`}>
                <option value="true">Active</option><option value="false">Inactive</option>
              </NativeSelect>
            </Field>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid={`${kind}-cancel`}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid={`${kind}-save`}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={Boolean(openRoutes)} onOpenChange={(open) => { if (!open && !saving) setOpenRoutes(null); }}>
        <AlertDialogContent data-testid="driver-deactivate-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Driver still has open routes</AlertDialogTitle>
            <AlertDialogDescription>
              {person?.name} still has {openRoutes?.length} open route{openRoutes?.length === 1 ? "" : "s"} ({openRoutes?.map((r) => `${r.id}, ${r.date}`).join("; ")}). Do you really want to set this driver inactive? These routes will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} data-testid="driver-deactivate-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={async (event) => { event.preventDefault(); await saveDriver(true); }} data-testid="driver-deactivate-confirm">
              {saving ? "Saving…" : "Set inactive and delete routes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
