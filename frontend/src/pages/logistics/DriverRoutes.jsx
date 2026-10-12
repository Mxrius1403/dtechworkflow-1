import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { checkRouteStop, finishRoute, startRoute } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { Muted } from "@/components/common/Bits";
import { Panel } from "@/components/common/Panel";
import { RouteStopRow } from "./RouteStopRow";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { ACTIVE_ROUTE_STATUSES, groupStopsByClinic, orderedStops } from "@/lib/logistics";

/** What a signed-in driver sees: their own open routes and the stops still to do. */
export function DriverRoutes() {
  const { user } = useSession();
  const { routes, byId } = useData();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = async (action, message) => {
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      if (message) notify(message);
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not update the route");
    } finally {
      setBusy(false);
    }
  };
  const open = routes
    .filter((r) => r.driverId === user.id && ACTIVE_ROUTE_STATUSES.includes(r.status))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return (
    <div className="grid gap-4" data-testid="driver-routes">
      {!open.length && <Panel title="Routes to do"><Muted>No open routes assigned to you.</Muted></Panel>}
      {open.map((route) => {
        const stops = orderedStops(route, byId.routePlans[route.id], byId.stops);
        const todo = stops.filter((s) => s.status !== "completed");
        let stopIndex = 0;
        const groups = groupStopsByClinic(stops).map((group) => ({
          ...group,
          stops: group.stops.map((stop) => ({ stop, index: stopIndex++ })),
        }));
        return (
          <Panel
            key={route.id}
            title={`${route.date} • ${route.id}`}
            description={`${todo.length} of ${stops.length} stops still to do`}
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge kind="route" value={route.status} />
                {route.status === "published" && (
                  <Button size="sm" disabled={busy || !stops.length} onClick={() => run(() => startRoute(route.id), "Route started")} data-testid={`route-start-${route.id}`}>Start Route</Button>
                )}
                {route.status === "started" && (
                  <Button size="sm" disabled={busy} onClick={() => {
                    if (!todo.length || window.confirm(`${todo.length} stop(s) are not checked and their cases will be set to Not Delivered. Finish the route?`)) run(() => finishRoute(route.id), "Route finished");
                  }} data-testid={`route-finish-${route.id}`}>Finish Route</Button>
                )}
              </div>
            }
          >
            <div className="grid gap-2">
              {groups.map((group) => (
                <section key={group.clinicId} className="grid gap-2" data-testid={`route-clinic-group-${group.clinicId}`}>
                  <h3 className="text-sm font-semibold text-primary">{byId.clinics[group.clinicId]?.name || group.clinicId}</h3>
                  {group.stops.map(({ stop, index }) => (
                    <RouteStopRow key={stop.id} index={index} route={route} stop={stop} readOnly
                      onCheck={route.status === "started" ? (checked) => run(() => checkRouteStop(route.id, stop.id, checked)) : undefined}
                      checkDisabled={busy} />
                  ))}
                </section>
              ))}
              {!stops.length && <Muted>No stops.</Muted>}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
