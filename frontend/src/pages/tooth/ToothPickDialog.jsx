import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/Field";
import { notifyError } from "@/lib/notify";

/** Shade + quantity for one tooth (replaces the original two browser prompts). */
export function ToothPickDialog({ pick, onAdd, onClose }) {
  const [shade, setShade] = useState("A1");
  const [qty, setQty] = useState("1");
  const add = () => {
    const n = Number(qty);
    if (!shade.trim()) return notifyError("Enter a shade");
    if (!Number.isInteger(n) || n < 1) return notifyError("Quantity must be a whole number of at least 1");
    onAdd(shade.trim(), n);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" data-testid="tooth-pick-dialog">
        <DialogHeader>
          <DialogTitle>Tooth {pick.tooth}</DialogTitle>
          <DialogDescription>{pick.group}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shade"><Input value={shade} onChange={(e) => setShade(e.target.value)} autoFocus data-testid="tooth-pick-shade" /></Field>
          <Field label="Quantity"><Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} data-testid="tooth-pick-qty" /></Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="tooth-pick-cancel">Cancel</Button>
          <Button onClick={add} data-testid="tooth-pick-add">Add to Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
