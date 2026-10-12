import { useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Muted } from "@/components/common/Bits";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { Panel } from "@/components/common/Panel";
import { CountPill, StatusBadge } from "@/components/common/StatusBadge";
import { departmentName } from "@/lib/cases";
import { plural } from "@/lib/format";
import { deleteMaterialOrder, updateMaterialOrderStatus } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { materialOrderPdfHtml, printHtml } from "@/lib/print";

function MaterialOrderListPanel({ title, description, orders, manager, completed, queryClient }) {
  const removeOrder = async (orderId) => {
    try {
      await deleteMaterialOrder(orderId);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify("Material order deleted");
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not delete the material order");
    }
  };
  const markOrderDone = async (orderId) => {
    try {
      await updateMaterialOrderStatus(orderId, "done");
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify("Material order marked as done");
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not update the material order");
    }
  };

  return (
    <Panel title={title} description={description} actions={<CountPill testId={completed ? "completed-material-orders-count" : "material-orders-count"}>{orders.length}</CountPill>}>
      <div className="grid gap-2">
        {orders.map((o) => (
          <div key={o.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3" data-testid={`material-order-${o.id}`}>
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-primary">{o.id}</span>
                <StatusBadge kind="order" value={o.status} testId={`material-order-status-${o.id}`} />
              </p>
              <p className="text-xs text-muted-foreground">
                {o.requestedBy}{manager && o.department && ` • ${departmentName(o.department)}`} • {o.date} {o.time} • {plural(o.totalItems, "item")}
              </p>
              <ul className="text-sm">
                {(o.items || []).map((i, n) => <li key={`${i.productId || i.code}-${n}`}><b>{i.qty} ×</b> <span className="font-mono text-xs">{i.code}</span> — {i.description}</li>)}
              </ul>
              {o.notes && <p className="text-xs text-muted-foreground">Notes: {o.notes}</p>}
            </div>
            {manager && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => printHtml(materialOrderPdfHtml(o))} data-testid={`material-order-pdf-${o.id}`}><FileText /> Download PDF</Button>
                {!completed && <Button size="sm" onClick={() => markOrderDone(o.id)} data-testid={`material-order-done-${o.id}`}><Check /> Mark done</Button>}
                <ConfirmAction title="Delete this material order?" description="This action cannot be undone." confirmLabel="Delete" onConfirm={() => removeOrder(o.id)} testId={`material-order-delete-${o.id}`}>
                  <Button size="sm" variant="destructive" data-testid={`material-order-delete-button-${o.id}`}><Trash2 /> Delete</Button>
                </ConfirmAction>
              </div>
            )}
          </div>
        ))}
        {!orders.length && <Muted>{completed ? "No completed material orders." : manager ? "No material order requests yet." : "No material orders yet."}</Muted>}
      </div>
    </Panel>
  );
}

/** Material order history: managers can process every request; technicians see their own. */
export function MaterialOrderList({ title, description, orders, manager = false }) {
  const queryClient = useQueryClient();
  const rows = [...orders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (!manager) {
    return (
      <MaterialOrderListPanel
        title={title}
        description={description}
        orders={rows}
        manager={false}
        completed={false}
        queryClient={queryClient}
      />
    );
  }

  const openOrders = rows.filter((order) => order.status !== "done");
  const completedOrders = rows.filter((order) => order.status === "done");
  return (
    <div className="grid gap-5">
      <MaterialOrderListPanel
        title={title}
        description={description}
        orders={openOrders}
        manager
        completed={false}
        queryClient={queryClient}
      />
      <MaterialOrderListPanel
        title="Completed material orders"
        orders={completedOrders}
        manager
        completed
        queryClient={queryClient}
      />
    </div>
  );
}
