import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/Field";
import { useSession } from "@/context/SessionContext";
import { notify, notifyError } from "@/lib/notify";

export function AccountDialog({ onClose }) {
  const { user, updateProfile } = useSession();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) return notifyError("Enter a name");
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      notify("Account name updated");
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not update account name. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid="account-dialog">
        <DialogHeader>
          <DialogTitle>Staff Account</DialogTitle>
          <DialogDescription>Update the name displayed across your account.</DialogDescription>
        </DialogHeader>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="account-name-input" /></Field>
        <Field label="Staff ID"><Input value={user.id} disabled /></Field>
        <DialogFooter><Button onClick={save} disabled={saving} data-testid="account-save">{saving ? "Saving…" : "Save Name"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
