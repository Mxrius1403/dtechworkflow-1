import { Muted } from "@/components/common/Bits";
import { Panel } from "@/components/common/Panel";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { ACTIVE_ROUTE_STATUSES, orderedStops, stopJobs } from "@/lib/logistics";

/** What a signed-in driver sees: their own open routes and the stops still to do. */
export function DriverRoutes() {
  const { user } = useSession();
  const { routes, byId } = useData();
  const open = routes
    .filter((r) => r.driverId === user.id && ACTIVE_ROUTE_STATUSES.includes(r.status))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return (
    <div className="grid gap-4" data-testid="driver-routes">
      {!open.length && <Panel title="Routes to do"><Muted>No open routes assigned to you.</Muted></Panel>}
      {open.map((route) => {
        const stops = orderedStops(route, byId.routePlans[route.id], byId.stops);
        const todo = stops.filter((s) => s.status !== "completed");
        return (
          <Panel
            key={route.id}
            title={`${route.date} • ${route.id}`}
            description={`${todo.length} of ${stops.length} stops still to do`}
            actions={<StatusBadge kind="route" value={route.status} />}
          >
            <div className="grid gap-2">
              {todo.map((stop, index) => {
                const clinic = byId.clinics[stop.clinicId] || {};
                return (
                  <div key={stop.id} className="rounded-lg border p-3" data-testid={`driver-stop-${stop.id}`}>
                    <p className="font-semibold text-primary">
                      <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span> {clinic.name || stop.clinicId}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {[clinic.address, clinic.eircode].filter(Boolean).join(", ")} • {stopJobs(stop) || "No jobs"} <StatusBadge kind="stop" value={stop.status} />
                    </p>
                  </div>
                );
              })}
              {!todo.length && <Muted>All stops completed.</Muted>}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
