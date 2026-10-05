import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { useData } from "@/context/DataContext";
import { BigAction, Card, MissionHero, RouteTimeline } from "./DriverParts";
import { PlanningList } from "./PlanningList";

/** Stages before the route starts: START MY DAY -> load cases -> plan clinic order -> confirmed preview. */
export function PublishedStages({ route, flow, cases, counts, planned, alerts }) {
  const { byId, settings } = useData();
  const start = `Start: ${settings.labName || "Dentaltech Group"} — ${route.startEircode}`;
  const allChecked = cases.every((x) => flow.checked.has(x.caseNumber));

  if (flow.stage === "checklist") {
    return (
      <Card testId="driver-checklist">
        <h2 className="text-xl font-bold text-primary">Cases to Take</h2>
        <p className="mb-3 text-sm text-muted-foreground">Check every delivery case before leaving the laboratory.</p>
        <div className="grid gap-2">
          {cases.map((x) => (
            <label key={x.caseNumber} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:border-secondary" data-testid={`load-case-${x.caseNumber}`}>
              <Checkbox checked={flow.checked.has(x.caseNumber)} onCheckedChange={(on) => flow.toggleLoaded(x.caseNumber, on)} data-testid={`load-check-${x.caseNumber}`} />
              <span><b className="font-mono text-primary">{x.caseNumber}</b><span className="block text-xs text-muted-foreground">{x.clinic}</span></span>
            </label>
          ))}
          {!cases.length && <p className="text-sm text-muted-foreground">No delivery cases. You can continue.</p>}
        </div>
        <BigAction className="mt-4" disabled={!allChecked} onClick={flow.startPlanning} data-testid="driver-plan-route">{planned ? "VIEW CONFIRMED ROUTE" : "PLAN MY ROUTE"}</BigAction>
      </Card>
    );
  }
  if (flow.stage === "planning") {
    return (
      <>
        <MissionHero title="Plan My Route" text="Choose the clinic sequence you want to follow." note={start} />
        <Card><p className="mb-3 text-sm text-muted-foreground">Use Maps to check a location, then move each clinic up or down.</p><PlanningList order={flow.order} locked={0} onMove={flow.move} /></Card>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12" onClick={() => flow.setStage("checklist")} data-testid="driver-plan-back">Back</Button>
          <ConfirmAction title="Confirm this clinic order?" description="The Manager will follow the sequence you choose." confirmLabel="Confirm route" onConfirm={flow.confirmRoute} testId="driver-confirm-route">
            <Button className="h-12 font-bold" data-testid="driver-confirm-route-button">CONFIRM MY ROUTE</Button>
          </ConfirmAction>
        </div>
      </>
    );
  }
  if (flow.stage === "preview") {
    return (
      <>
        <MissionHero title="Route Confirmed" text="This is the clinic order you selected." note={start} />
        <Card><RouteTimeline stops={flow.order.map((id) => byId.stops[id]).filter(Boolean)} /></Card>
        <BigAction onClick={flow.startMission} data-testid="driver-start-route">START ROUTE</BigAction>
      </>
    );
  }
  return (
    <>
      {alerts}
      <MissionHero title="Today's Mission" text={counts} note={planned ? "Your clinic order is confirmed" : "You will choose the clinic order before starting"}>
        <BigAction onClick={flow.beginDay} data-testid="driver-start-day">START MY DAY</BigAction>
      </MissionHero>
    </>
  );
}
