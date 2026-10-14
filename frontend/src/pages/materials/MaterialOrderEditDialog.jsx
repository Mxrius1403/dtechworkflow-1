import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Muted } from "@/components/common/Bits";
import { Field } from "@/components/common/Field";
import { fetchProducts, updateMaterialOrder } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";

const EMPTY_PRODUCTS = [];

/** Managers correct a material request: change quantities, remove lines or add missing products. */
export function MaterialOrderEditDialog({ order, onClose }) {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const products = productsQuery.data || EMPTY_PRODUCTS;
  const [lines, setLines] = useState(() => (order.items || []).map((i) => ({ productId: i.productId, code: i.code, description: i.description, qty: String(i.qty) })));
  const [notes, setNotes] = useState(order.notes || "");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = words.length
    ? products
      .filter((p) => !lines.some((l) => l.productId === p.id))
      .filter((p) => words.every((w) => [p.refNo, p.title, p.producer].join(" ").toLowerCase().includes(w)))
      .slice(0, 6)
    : [];

  const setQty = (n, qty) => setLines(lines.map((l, k) => (k === n ? { ...l, qty } : l)));
  const addProduct = (p) => {
    setLines([...lines, { productId: p.id, code: p.refNo, description: p.title, qty: "1" }]);
    setSearch("");
  };

  const save = async () => {
    if (!lines.length) return notifyError("Keep at least one product, or delete the order instead");
    const items = lines.map((l) => ({ productId: l.productId, qty: Number(l.qty) }));
    if (items.some((i) => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 999)) return notifyError("Quantities must be whole numbers from 1 to 999");
    setSaving(true);
    try {
      await updateMaterialOrder(order.id, { items, notes });
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Material order ${order.id} updated`);
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not update the material order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" data-testid="material-order-edit-dialog">
        <DialogHeader>
          <DialogTitle>Edit {order.id}</DialogTitle>
          <DialogDescription>Requested by {order.requestedBy} • {order.date} {order.time}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {lines.map((l, n) => (
            <div key={`${l.productId}-${n}`} className="flex min-w-0 items-center gap-2 rounded-lg border p-2" data-testid={`material-edit-line-${n}`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs font-bold text-primary">{l.code}</span>
                <span className="block truncate text-xs text-muted-foreground">{l.description}</span>
              </span>
              <Input type="number" min="1" max="999" className="h-8 w-20" value={l.qty} onChange={(e) => setQty(n, e.target.value)} aria-label={`Quantity for ${l.code}`} data-testid={`material-edit-qty-${n}`} />
              <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => setLines(lines.filter((_, k) => k !== n))} aria-label={`Remove ${l.code}`} data-testid={`material-edit-remove-${n}`}><X /></Button>
            </div>
          ))}
          {!lines.length && <Muted>No products on this order.</Muted>}
        </div>
        <Field label="Add product">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={productsQuery.isLoading ? "Loading products…" : "Search by reference number, title or producer…"} disabled={productsQuery.isLoading} data-testid="material-edit-search" />
        </Field>
        {matches.length > 0 && (
          <div className="grid gap-1" data-testid="material-edit-matches">
            {matches.map((p) => (
              <Button key={p.id} variant="outline" className="h-auto justify-start gap-2 px-2 py-1.5 text-left" onClick={() => addProduct(p)} data-testid={`material-edit-add-${p.id}`}>
                <Plus className="shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs font-bold text-primary">{p.refNo}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.title}</span>
                </span>
              </Button>
            ))}
          </div>
        )}
        {words.length > 0 && !matches.length && !productsQuery.isLoading && <Muted>No matching products.</Muted>}
        <Field label="Order notes">
          <Textarea rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="material-edit-notes" />
        </Field>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid="material-edit-cancel">Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="material-edit-save"><Save /> {saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
