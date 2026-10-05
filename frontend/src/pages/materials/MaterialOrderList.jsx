import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Muted } from "@/components/common/Bits";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { Panel } from "@/components/common/Panel";
import { CountPill, StatusBadge } from "@/components/common/StatusBadge";
import { departmentName } from "@/lib/cases";
import { plural } from "@/lib/format";
import { demoSave } from "@/lib/notify";
import { materialOrderPdfHtml, printHtml } from "@/lib/print";

const NEXT = { pending: ["ordered", "Mark Ordered"], ordered: ["received", "Mark Received"] };

function OrderActions({ o, manager }) {
  const next = NEXT[o.status];
  return (
    <div className="flex flex-wrap gap-2">
      {manager && <Button size="sm" onClick={() => printHtml(materialOrderPdfHtml(o))} data-testid={`material-order-pdf-${o.id}`}><FileText /> Download PDF</Button>}
      {manager && next && <Button size="sm" variant="outline" onClick={() => demoSave(`Order ${next[0]}`)} data-testid={`material-order-${next[0]}-${o.id}`}>{next[1]}</Button>}
      <ConfirmAction title="Delete this material order?" confirmLabel="Delete" onConfirm={() => demoSave("Material order deleted")} testId={`material-order-delete-${o.id}`}>
        <Button size="sm" variant="outline" className="text-rose-700" data-testid={`material-order-delete-button-${o.id}`}><Trash2 /> Delete</Button>
      </ConfirmAction>
    </div>
  );
}

/** Material order history: managers see every request with status actions, technicians see their own. */
export function MaterialOrderList({ title, description, orders, manager = false }) {
  const rows = [...orders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return (
    <Panel title={title} description={description} actions={<CountPill testId="material-orders-count">{rows.length}</CountPill>}>
      <div className="grid gap-2">
        {rows.map((o) => (
          <div key={o.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3" data-testid={`material-order-${o.id}`}>
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-primary">{o.id}</span>
                <StatusBadge kind="order" value={o.status} testId={`material-order-status-${o.id}`} />
              </p>
              <p className="text-xs text-muted-foreground">
                {o.requestedBy}{manager && ` • ${departmentName(o.department)}`} • {o.date} {o.time} • {plural(o.totalItems, "item")}
              </p>
              <ul className="text-sm">
                {(o.items || []).map((i) => <li key={i.productId}><b>{i.qty} ×</b> <span className="font-mono text-xs">{i.code}</span> — {i.description}</li>)}
              </ul>
              {o.notes && <p className="text-xs text-muted-foreground">Notes: {o.notes}</p>}
            </div>
            <OrderActions o={o} manager={manager} />
          </div>
        ))}
        {!rows.length && <Muted>{manager ? "No material order requests yet." : "No material orders yet."}</Muted>}
      </div>
    </Panel>
  );
}
