import { useEffect } from "react";
import { FileText, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Muted } from "@/components/common/Bits";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { Panel } from "@/components/common/Panel";
import { CountPill } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { deleteToothOrder } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { printHtml, toothOrderPdfHtml } from "@/lib/print";

export default function ToothOrdersPage() {
  const { toothOrders } = useData();
  const queryClient = useQueryClient();
  const orders = [...toothOrders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  useEffect(() => {
    const refresh = window.setInterval(
      () => queryClient.invalidateQueries({ queryKey: ["data"] }),
      15000,
    );
    return () => window.clearInterval(refresh);
  }, [queryClient]);

  const removeOrder = async (orderId) => {
    try {
      await deleteToothOrder(orderId);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify("Tooth order deleted");
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not delete the tooth order");
    }
  };
  return (
    <Panel title="Tooth Orders" description="Open the professional PDF to send the order to the supplier. Delete the order after it has been handled." actions={<CountPill testId="tooth-orders-count">{orders.length}</CountPill>}>
      <div className="grid gap-2">
        {orders.map((o) => (
          <div key={o.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-l-4 border-l-indigo-500 p-3" data-testid={`tooth-order-row-${o.id}`}>
            <div className="min-w-0 space-y-1.5">
              <p className="font-mono font-bold text-primary">{o.id}</p>
              <p className="text-xs text-muted-foreground">{o.technician} ({o.technicianId}) • {o.date} {o.time} • {o.total} teeth</p>
              <div className="flex flex-wrap gap-1.5">
                {o.items.map((i, n) => <span key={n} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">{i.tooth} • {i.shade} × {i.qty}</span>)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => printHtml(toothOrderPdfHtml(o))} data-testid={`tooth-order-pdf-${o.id}`}><FileText /> PDF</Button>
              <ConfirmAction title="Delete this tooth order?" description="This action cannot be undone." confirmLabel="Delete" onConfirm={() => removeOrder(o.id)} testId={`tooth-order-delete-${o.id}`}>
                <Button size="sm" variant="destructive" data-testid={`tooth-order-delete-button-${o.id}`}><Trash2 /> Delete</Button>
              </ConfirmAction>
            </div>
          </div>
        ))}
        {!orders.length && <Muted>No orders</Muted>}
      </div>
    </Panel>
  );
}
