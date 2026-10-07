import { useState } from "react";
import { Minus, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Muted } from "@/components/common/Bits";
import { Field } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";

export function MaterialCart({ cart, productsById, suppliers, notes, onNotes, onQty, onRemove, onSubmit, onClear }) {
  const [selectedProduct, setSelectedProduct] = useState(null);

  return (
    <>
      <Panel title="Current Order" className="lg:sticky lg:top-24" data-testid="material-cart">
        <div className="grid gap-2">
          {cart.map((i) => {
            const p = productsById[i.productId];
            const supplier = suppliers[p?.supplierId];
            const pack = [p?.quantity, p?.unit, p?.measure].filter(Boolean).join(" ");
            const summary = [supplier, pack].filter(Boolean).join(" · ");
            return (
              <div key={i.productId} className="flex min-w-0 items-center gap-2 rounded-lg border p-2.5" data-testid={`material-cart-line-${i.productId}`}>
                <Button
                  variant="ghost"
                  className="h-auto min-w-0 flex-1 justify-start overflow-hidden px-1 py-1 text-left"
                  onClick={() => p && setSelectedProduct(p)}
                  disabled={!p}
                  aria-label={`View details for ${p?.title || "product"}`}
                  data-testid={`material-cart-details-${i.productId}`}
                >
                  <span className="block min-w-0 flex-1 overflow-hidden">
                    <span className="block truncate font-mono text-xs font-bold text-primary" title={p?.refNo}>{p?.refNo}</span>
                    <span className="block truncate text-xs text-muted-foreground" title={p?.title}>{p?.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground" title={summary}>{summary}</span>
                  </span>
                </Button>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onQty(i.productId, -1)} data-testid={`material-cart-minus-${i.productId}`}><Minus /></Button>
                  <span className="w-6 text-center font-mono text-sm font-bold" data-testid={`material-cart-qty-${i.productId}`}>{i.qty}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onQty(i.productId, 1)} data-testid={`material-cart-plus-${i.productId}`}><Plus /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={() => onRemove(i.productId)} data-testid={`material-cart-remove-${i.productId}`}><X /></Button>
                </div>
              </div>
            );
          })}
          {!cart.length && <Muted>No products selected.</Muted>}
        </div>
        <Field label="Order notes" className="mt-3">
          <Textarea rows={3} maxLength={1000} value={notes} onChange={(e) => onNotes(e.target.value)} placeholder="Optional notes for the manager or supplier" data-testid="material-order-notes" />
        </Field>
        <div className="mt-3 grid gap-2">
          <Button onClick={onSubmit} data-testid="material-order-submit"><Send /> Send Material Order</Button>
          <Button variant="outline" onClick={onClear} data-testid="material-cart-clear">Clear</Button>
        </div>
      </Panel>
      <Dialog open={Boolean(selectedProduct)} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="material-cart-product-details">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.title}</DialogTitle>
            <DialogDescription>Product details</DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <dl className="grid min-w-0 gap-3 text-sm">
              {[
                ["Ref. No", selectedProduct.refNo],
                ["Title", selectedProduct.title],
                ["Producer", selectedProduct.producer],
                ["Supplier", suppliers[selectedProduct.supplierId] || "Supplier unavailable"],
                ["Unit", selectedProduct.unit],
                ["Quantity", selectedProduct.quantity],
                ["Measure", selectedProduct.measure],
              ].map(([label, value]) => (
                <div key={label} className="grid min-w-0 gap-1 border-b pb-2 last:border-0">
                  <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
