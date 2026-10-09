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
            actions={<StatusBadge kind="route" value={route.status} />}
          >
            <div className="grid gap-2">
              {groups.map((group) => (
                <section key={group.clinicId} className="grid gap-2" data-testid={`route-clinic-group-${group.clinicId}`}>
                  <h3 className="text-sm font-semibold text-primary">{byId.clinics[group.clinicId]?.name || group.clinicId}</h3>
                  {group.stops.map(({ stop, index }) => (
                    <RouteStopRow key={stop.id} index={index} route={route} stop={stop} readOnly />
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
