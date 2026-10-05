import { Minus, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Muted } from "@/components/common/Bits";
import { Field } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";

export function MaterialCart({ cart, productsById, notes, onNotes, onQty, onRemove, onSubmit, onClear }) {
  return (
    <Panel title="Current Order" className="lg:sticky lg:top-24" data-testid="material-cart">
      <div className="grid gap-2">
        {cart.map((i) => {
          const p = productsById[i.productId];
          return (
            <div key={i.productId} className="flex items-center justify-between gap-2 rounded-lg border p-2.5" data-testid={`material-cart-line-${i.productId}`}>
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-primary">{p?.code}</p>
                <p className="truncate text-xs text-muted-foreground" title={p?.description}>{p?.description}</p>
              </div>
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
  );
}
