import { useState } from "react";
import { Button } from "@/components/ui/button";
import { checkRouteStop, finishRoute, startRoute } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { Muted } from "@/components/common/Bits";
import { Panel } from "@/components/common/Panel";
import { RouteStopRow } from "./RouteStopRow";
import { FinishRouteDialog, ReportProblemDialog } from "./StopProblemDialogs";
import { useRouteCache } from "./routeCache";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { ACTIVE_ROUTE_STATUSES, groupStopsByClinic, orderedStops } from "@/lib/logistics";

const errorText = (error, fallback) => {
  const detail = error.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
};

const stopDone = (done) => ({
  status: done ? "completed" : "pending",
  arrived: done,
  deliveryCompleted: done,
  collectionCompleted: done,
});

/** What a signed-in driver sees: their own open routes and the stops still to do. */
export function DriverRoutes() {
  const { user } = useSession();
  const { routes, byId } = useData();
  const cache = useRouteCache();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState({});
  const [dialog, setDialog] = useState(null);
  const run = async (action, changes, message) => {
    setBusy(true);
    try {
      const result = await action();
      changes(result);
      cache.refresh();
      if (message) notify(message);
    } catch (error) {
      notifyError(errorText(error, "Could not update the route"));
    } finally {
      setBusy(false);
    }
  };
  // The tick shows at once; only a failed save puts the stop back.
  const check = async (route, stop, done) => {
    const before = { ...stopDone(stop.status === "completed"), problem: stop.problem };
    setSaving((all) => ({ ...all, [stop.id]: true }));
    await cache.hold();
    cache.patchStop(stop.id, done ? { ...stopDone(true), problem: undefined } : stopDone(false));
    try {
      await checkRouteStop(route.id, stop.id, done);
    } catch (error) {
      cache.patchStop(stop.id, before);
      notifyError(errorText(error, "Could not save this stop. Try again."));
    } finally {
      setSaving((all) => {
        const next = { ...all };
        delete next[stop.id];
        return next;
      });
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
                  <Button size="sm" disabled={busy || !stops.length} onClick={() => run(() => startRoute(route.id), () => cache.patchRoute(route.id, { status: "started" }), "Route started")} data-testid={`route-start-${route.id}`}>Start Route</Button>
                )}
                {route.status === "started" && (
                  <Button size="sm" disabled={busy} onClick={() => (
                    todo.length ? setDialog({ type: "finish", route, stops: todo }) : run(() => finishRoute(route.id), () => cache.patchRoute(route.id, { status: "completed" }), "Route finished. The managers have been told.")
                  )} data-testid={`route-finish-${route.id}`}>Finish Route</Button>
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
                      onCheck={route.status === "started" ? (done) => check(route, stop, done) : undefined}
                      onReportProblem={route.status === "started" ? () => setDialog({ type: "problem", route, stop }) : undefined}
                      checkDisabled={Boolean(saving[stop.id])} />
                  ))}
                </section>
              ))}
              {!stops.length && <Muted>No stops.</Muted>}
            </div>
          </Panel>
        );
      })}
      {dialog?.type === "problem" && <ReportProblemDialog route={dialog.route} stop={dialog.stop} onClose={() => setDialog(null)} />}
      {dialog?.type === "finish" && <FinishRouteDialog route={dialog.route} openStops={dialog.stops} onClose={() => setDialog(null)} />}
    </div>
  );
}
