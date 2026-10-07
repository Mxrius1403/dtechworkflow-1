import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Muted } from "@/components/common/Bits";
import { Panel } from "@/components/common/Panel";
import { CountPill } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { createToothOrder } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { ToothPickDialog } from "./ToothPickDialog";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function ToothGroup({ group, items, onPick }) {
  return (
    <div className="mb-5 last:mb-0" data-testid={`tooth-group-${slug(group.name)}`}>
      <p className="eyebrow mb-2">{group.name}</p>
      <div className="flex flex-wrap gap-2">
        {group.teeth.map((t) => {
          const has = items.some((i) => i.group === group.name && i.tooth === t);
          return (
            <button key={t} onClick={() => onPick({ group: group.name, tooth: t })} data-testid={`tooth-${slug(group.name)}-${t.toLowerCase()}`}
              className={cn("lift min-w-[3rem] rounded-lg border px-3 py-2 font-mono text-sm font-bold", has ? "border-secondary bg-secondary text-white" : "bg-card text-primary hover:border-secondary")}>
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ToothOrderPage() {
  const { catalog } = useData();
  const queryClient = useQueryClient();
  const [items, setItems] = useState([]);
  const [picking, setPicking] = useState(null);
  const [saving, setSaving] = useState(false);
  const total = items.reduce((n, i) => n + i.qty, 0);
  const send = async () => {
    if (!items.length) return notifyError("No teeth selected");
    setSaving(true);
    try {
      const order = await createToothOrder({ items });
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Order Tooth ${order.id} sent to manager`);
      setItems([]);
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not send the Order Tooth");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
      <Panel title="New Order Tooth" description="Select a tooth, then choose its shade and quantity.">
        {catalog.toothGroups.map((g) => <ToothGroup key={g.name} group={g} items={items} onPick={setPicking} />)}
      </Panel>
      <Panel title="Order Summary" actions={<CountPill testId="tooth-order-total">{total} teeth</CountPill>} className="lg:sticky lg:top-24">
        <div className="grid gap-1.5" data-testid="tooth-order-summary">
          {items.map((i, n) => (
            <div key={`${i.group}-${i.tooth}-${n}`} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm" data-testid={`tooth-line-${n}`}>
              <span className="min-w-0 truncate">{i.group} • <b className="font-mono">{i.tooth}</b> • {i.shade} • Qty {i.qty}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={() => setItems(items.filter((_, k) => k !== n))} data-testid={`tooth-line-remove-${n}`}><X /></Button>
            </div>
          ))}
          {!items.length && <Muted>No teeth selected.</Muted>}
        </div>
        <div className="mt-4 grid gap-2">
          <Button onClick={send} disabled={saving} data-testid="tooth-order-send">{saving ? "Sending…" : <><Send /> Send to Manager</>}</Button>
          <Button variant="outline" onClick={() => setItems([])} disabled={saving} data-testid="tooth-order-clear">Clear</Button>
        </div>
      </Panel>
      {picking && <ToothPickDialog pick={picking} onClose={() => setPicking(null)} onAdd={(shade, qty) => setItems([...items, { ...picking, shade, qty }])} />}
    </div>
  );
}
