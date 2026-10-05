import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/Field";
import { useSession } from "@/context/SessionContext";
import { demoSave, notifyError } from "@/lib/notify";

export function AccountDialog({ onClose }) {
  const { user } = useSession();
  const [name, setName] = useState(user.name);
  const save = () => {
    if (!name.trim()) return notifyError("Enter a name");
    demoSave("Manager account updated");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid="account-dialog">
        <DialogHeader>
          <DialogTitle>Manager Account</DialogTitle>
          <DialogDescription>Passwords are managed by the sign-in provider and never stored in the database.</DialogDescription>
        </DialogHeader>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="account-name-input" /></Field>
        <Field label="Staff ID"><Input value={user.id} disabled /></Field>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => demoSave("Password reset email sent")} data-testid="account-reset-password">Send Password Reset</Button>
          <Button onClick={save} data-testid="account-save">Save Name</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
