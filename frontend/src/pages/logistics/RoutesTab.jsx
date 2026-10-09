import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { Panel } from "@/components/common/Panel";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { nice } from "@/lib/format";
import { routeStops } from "@/lib/logistics";
import { RouteDialog } from "./RouteDialog";

export function RoutesTab() {
  const { routes, byId } = useData();
  const [openId, setOpenId] = useState(null);
  const routesByDate = routes.reduce((groups, route) => {
    (groups[route.date] ||= []).push(route);
    return groups;
  }, {});
  const dates = Object.keys(routesByDate).sort((a, b) => a.localeCompare(b));
  const progress = (r) => {
    const stops = routeStops(r, byId.stops);
    return `${stops.filter((s) => s.status === "completed").length}/${stops.length}`;
  };
  const columns = [
    { key: "id", header: "Route", render: (r) => <span className="font-mono font-bold">{r.id}</span> },
    { key: "driver", header: "Driver", render: (r) => `${r.driverId} — ${byId.drivers[r.driverId]?.name || ""}` },
    { key: "stops", header: "Stops", render: (r) => r.stopIds.length },
    { key: "status", header: "Status", render: (r) => <StatusBadge kind="route" value={r.status} testId={`route-status-${r.id}`} /> },
    { key: "progress", header: "Progress", render: (r) => <span className="font-mono">{progress(r)}</span> },
    { key: "open", header: "", render: (r) => <Button size="sm" variant="outline" onClick={() => setOpenId(r.id)} data-testid={`route-open-${r.id}`}>Open</Button> },
  ];
  return (
    <Panel
      title="Existing Routes"
      description="All routes, grouped by delivery date. Open a route to add a stop, transfer a pending destination to another driver, manage tracking email, or delete a route that has not started."
    >
      <div className="grid gap-6" data-testid="routes-table">
        {!dates.length && <p className="py-8 text-center text-sm text-muted-foreground">No routes found.</p>}
        {dates.map((date) => (
          <section key={date} className="grid gap-3" aria-labelledby={`routes-date-${date}`}>
            <h3 id={`routes-date-${date}`} className="text-sm font-semibold text-primary">{nice(date)}</h3>
            <DataTable rows={routesByDate[date].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))} rowTestId={(r) => `route-row-${r.id}`} columns={columns} />
          </section>
        ))}
      </div>
      {openId && byId.routes[openId] && <RouteDialog route={byId.routes[openId]} onClose={() => setOpenId(null)} />}
    </Panel>
  );
}
