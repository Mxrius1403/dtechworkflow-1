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
          <DialogTitle>Staff Account</DialogTitle>
          <DialogDescription>Your password is securely hashed. Account profile changes are still demo-only.</DialogDescription>
        </DialogHeader>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="account-name-input" /></Field>
        <Field label="Staff ID"><Input value={user.id} disabled /></Field>
        <DialogFooter><Button onClick={save} data-testid="account-save">Save Name</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
