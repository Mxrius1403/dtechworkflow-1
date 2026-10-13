import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Muted } from "@/components/common/Bits";
import { Field, NativeSelect, Options } from "@/components/common/Field";
import { useData } from "@/context/DataContext";
import { updateToothOrder } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";

/** Managers correct a tooth request: change shades or quantities, remove lines or add missing teeth. */
export function ToothOrderEditDialog({ order, onClose }) {
  const { catalog } = useData();
  const queryClient = useQueryClient();
  const groups = catalog.toothGroups;
  const [lines, setLines] = useState(() => order.items.map((i) => ({ ...i, qty: String(i.qty) })));
  const [draft, setDraft] = useState(() => ({ group: groups[0]?.name || "", tooth: groups[0]?.teeth[0] || "", shade: "A1", qty: "1" }));
  const [saving, setSaving] = useState(false);
  const teeth = groups.find((g) => g.name === draft.group)?.teeth || [];

  const setLine = (n, key, value) => setLines(lines.map((l, k) => (k === n ? { ...l, [key]: value } : l)));
  const pickGroup = (group) => setDraft({ ...draft, group, tooth: groups.find((g) => g.name === group)?.teeth[0] || "" });
  const addTooth = () => {
    if (!draft.group || !draft.tooth) return notifyError("Choose a tooth");
    setLines([...lines, { ...draft }]);
  };

  const save = async () => {
    if (!lines.length) return notifyError("Keep at least one tooth, or delete the order instead");
    const items = lines.map((l) => ({ group: l.group, tooth: l.tooth, shade: l.shade.trim(), qty: Number(l.qty) }));
    if (items.some((i) => !i.shade)) return notifyError("Every tooth needs a shade");
    if (items.some((i) => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 999)) return notifyError("Quantities must be whole numbers from 1 to 999");
    setSaving(true);
    try {
      await updateToothOrder(order.id, { items });
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Order Tooth ${order.id} updated`);
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not update the Order Tooth");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" data-testid="tooth-order-edit-dialog">
        <DialogHeader>
          <DialogTitle>Edit {order.id}</DialogTitle>
          <DialogDescription>Ordered by {order.technician} • {order.date} {order.time}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {lines.map((l, n) => (
            <div key={`${l.group}-${l.tooth}-${n}`} className="flex min-w-0 items-center gap-2 rounded-lg border p-2" data-testid={`tooth-edit-line-${n}`}>
              <span className="min-w-0 flex-1 truncate text-sm">{l.group} • <b className="font-mono">{l.tooth}</b></span>
              <Input className="h-8 w-20" maxLength={24} value={l.shade} onChange={(e) => setLine(n, "shade", e.target.value)} aria-label={`Shade for ${l.tooth}`} data-testid={`tooth-edit-shade-${n}`} />
              <Input type="number" min="1" max="999" className="h-8 w-16" value={l.qty} onChange={(e) => setLine(n, "qty", e.target.value)} aria-label={`Quantity for ${l.tooth}`} data-testid={`tooth-edit-qty-${n}`} />
              <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => setLines(lines.filter((_, k) => k !== n))} aria-label={`Remove ${l.tooth}`} data-testid={`tooth-edit-remove-${n}`}><X /></Button>
            </div>
          ))}
          {!lines.length && <Muted>No teeth on this order.</Muted>}
        </div>
        <div className="grid gap-3 rounded-lg border border-dashed p-3">
          <p className="eyebrow">Add tooth</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Group" className="col-span-2 sm:col-span-1">
              <NativeSelect value={draft.group} onChange={(e) => pickGroup(e.target.value)} data-testid="tooth-edit-new-group"><Options items={groups.map((g) => [g.name, g.name])} /></NativeSelect>
            </Field>
            <Field label="Tooth">
              <NativeSelect value={draft.tooth} onChange={(e) => setDraft({ ...draft, tooth: e.target.value })} data-testid="tooth-edit-new-tooth"><Options items={teeth.map((t) => [t, t])} /></NativeSelect>
            </Field>
            <Field label="Shade"><Input maxLength={24} value={draft.shade} onChange={(e) => setDraft({ ...draft, shade: e.target.value })} data-testid="tooth-edit-new-shade" /></Field>
            <Field label="Quantity"><Input type="number" min="1" max="999" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} data-testid="tooth-edit-new-qty" /></Field>
          </div>
          <Button variant="outline" onClick={addTooth} data-testid="tooth-edit-add"><Plus /> Add to order</Button>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid="tooth-edit-cancel">Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="tooth-edit-save"><Save /> {saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
