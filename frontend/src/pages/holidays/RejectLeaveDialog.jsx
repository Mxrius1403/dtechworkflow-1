import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/Field";
import { useData } from "@/context/DataContext";
import { nice } from "@/lib/format";
import { demoSave } from "@/lib/notify";

export function RejectLeaveDialog({ request: r, onClose }) {
  const { techName } = useData();
  const [reason, setReason] = useState("");
  const reject = () => {
    demoSave(reason.trim() ? `Holiday rejected — ${reason.trim()}` : "Holiday rejected");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="leave-reject-dialog">
        <DialogHeader>
          <DialogTitle>Reject holiday request</DialogTitle>
          <DialogDescription>{techName(r.technicianId, r.technicianName)} • {nice(r.from)} to {nice(r.to)}</DialogDescription>
        </DialogHeader>
        <Field label="Reason for rejection (optional)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} data-testid="leave-reject-reason" />
        </Field>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="leave-reject-cancel">Cancel</Button>
          <Button variant="destructive" onClick={reject} data-testid="leave-reject-confirm">Reject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
