import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { timeOf } from "@/lib/format";
import { defaultDriverDate, driverPlanNeedsUpdate, orderedStops, validDriverPlan } from "@/lib/logistics";
import { demoSave } from "@/lib/notify";
import { ActiveMission } from "./ActiveMission";
import { BigAction, Card, DriverAlert, MissionHero, RouteTimeline } from "./DriverParts";
import { PlanningList } from "./PlanningList";
import { PublishedStages } from "./PublishedStages";
import { useDriverFlow } from "./useDriverFlow";

function Alerts({ notes, updating, flow }) {
  const urgent = notes.some((n) => n.type === "urgent_stop");
  const place = <BigAction className="h-11 text-sm" onClick={flow.startUpdatePlanning} data-testid="driver-place-stop">PLACE NEW STOP</BigAction>;
  return (
    <>
      {notes.map((n) => (
        <DriverAlert key={n.id} title="Route updated" text={n.message} testId={`driver-alert-${n.id}`}
          action={n.type === "urgent_stop" ? place : <Button variant="outline" size="sm" onClick={() => demoSave("Notification dismissed")} data-testid={`driver-dismiss-${n.id}`}>Dismiss</Button>} />
      ))}
      {updating && !urgent && <DriverAlert title="Urgent stop awaiting placement" text="Review the remaining route and choose where the new clinic should be visited." action={place} testId="driver-alert-unplaced" />}
    </>
  );
}

/** Picks the right stage for one route; see useDriverFlow for the stage rules. */
export function DriverMission({ route }) {
  const { byId, notifications } = useData();
  const { driver } = useSession();
  const plan = byId.routePlans[route.id];
  const flow = useDriverFlow(route, plan, byId.stops);
  const stops = orderedStops(route, plan, byId.stops);
  const current = stops.find((s) => s.status !== "completed");
  const completed = stops.filter((s) => s.status === "completed").length;
  const cases = stops.flatMap((s) => (s.deliveries || []).map((d) => ({ caseNumber: d.caseNumber, clinic: byId.clinics[s.clinicId]?.name || s.clinicId })));
  const counts = `${route.totalStops || stops.length} stops • ${cases.length} deliveries • ${stops.filter((s) => s.collections?.length).length} collections`;
  const notes = notifications.filter((n) => n.driverUid === driver.uid && !n.read && n.routeId === route.id);
  const updating = driverPlanNeedsUpdate(route, plan);
  const alerts = <Alerts notes={notes} updating={updating} flow={flow} />;

  if (route.status === "completed") {
    return (
      <>
        <MissionHero done title="Mission Completed" text={`${completed} clinics visited • ${route.completedAt ? timeOf(route.completedAt) : "Completed"}`} />
        <Card><RouteTimeline stops={stops} /></Card>
      </>
    );
  }
  if (route.date !== defaultDriverDate()) {
    return (
      <>
        <MissionHero title="Scheduled Mission" text={counts} note={validDriverPlan(route, plan) ? "Route order confirmed" : "Clinic order to be planned on the route date"} />
        <Card><p className="mb-3 text-sm text-muted-foreground">This mission is read-only until {route.date}.</p><RouteTimeline stops={stops} current={current} /></Card>
      </>
    );
  }
  if (route.status === "published") return <PublishedStages route={route} flow={flow} cases={cases} counts={counts} planned={validDriverPlan(route, plan)} alerts={alerts} />;
  if (flow.stage === "replanning") {
    return (
      <>
        <MissionHero title="Place Urgent Stop" text="Your completed stops and current clinic remain fixed." note="Choose where the new clinic enters among the remaining visits." />
        <Card><PlanningList order={flow.order} locked={flow.locked} onMove={flow.move} /></Card>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12" onClick={() => flow.setStage("active")} data-testid="driver-replan-cancel">Continue Current Route</Button>
          <ConfirmAction title="Confirm the updated remaining route?" description="Existing clinic links will update automatically." confirmLabel="Confirm" onConfirm={flow.confirmUpdate} testId="driver-confirm-update">
            <Button className="h-12 font-bold" data-testid="driver-confirm-update-button">CONFIRM UPDATED ROUTE</Button>
          </ConfirmAction>
        </div>
      </>
    );
  }
  return <ActiveMission route={route} flow={flow} stops={stops} current={current} completed={completed} alerts={alerts} />;
}
