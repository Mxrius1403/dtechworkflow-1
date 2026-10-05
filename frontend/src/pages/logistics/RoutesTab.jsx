import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/common/DataTable";
import { Field } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { routeStops } from "@/lib/logistics";
import { RouteDialog } from "./RouteDialog";

export function RoutesTab({ date, onDateChange }) {
  const { routes, byId } = useData();
  const [openId, setOpenId] = useState(null);
  const rows = routes.filter((r) => r.date === date).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const progress = (r) => {
    const stops = routeStops(r, byId.stops);
    return `${stops.filter((s) => s.status === "completed").length}/${stops.length}`;
  };
  return (
    <Panel
      title="Existing Routes"
      description="Open a route to add a stop, transfer a pending destination to another driver, manage tracking email, or delete a route that has not started."
      actions={<Field label="Date"><Input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} className="w-44" data-testid="routes-date" /></Field>}
    >
      <DataTable testId="routes-table" rows={rows} rowTestId={(r) => `route-row-${r.id}`} empty="No routes for this date." columns={[
        { key: "id", header: "Route", render: (r) => <span className="font-mono font-bold">{r.id}</span> },
        { key: "driver", header: "Driver", render: (r) => `${r.driverId} — ${byId.drivers[r.driverId]?.name || ""}` },
        { key: "stops", header: "Stops", render: (r) => r.stopIds.length },
        { key: "status", header: "Status", render: (r) => <StatusBadge kind="route" value={r.status} testId={`route-status-${r.id}`} /> },
        { key: "progress", header: "Progress", render: (r) => <span className="font-mono">{progress(r)}</span> },
        { key: "open", header: "", render: (r) => <Button size="sm" variant="outline" onClick={() => setOpenId(r.id)} data-testid={`route-open-${r.id}`}>Open</Button> },
      ]} />
      {openId && byId.routes[openId] && <RouteDialog route={byId.routes[openId]} onClose={() => setOpenId(null)} />}
    </Panel>
  );
}
