import { Coffee, Navigation, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from "@/context/DataContext";
import { notifyError } from "@/lib/notify";
import { Card, MissionHero, RouteTimeline } from "./DriverParts";
import { openMaps } from "./PlanningList";

function CurrentStop({ route, stops, current }) {
  const { byId } = useData();
  if (!current) return <Card className="py-8 text-center" testId="driver-all-done"><h2 className="text-xl font-bold text-primary">All stops completed</h2></Card>;
  const clinic = byId.clinics[current.clinicId] || {};
  const started = route.status === "started";
  const arrive = () => (started ? notifyError("Arrival tracking is not connected to server storage.") : notifyError("Resume the route before marking arrival"));
  const confirm = (type) => {
    if (!current.arrived) return notifyError("Mark Arrived before confirming the visit");
    if (!started) return notifyError("Resume the route before confirming the visit");
    notifyError(`${type === "delivery" ? "Delivery" : "Collection"} tracking is not connected to server storage.`);
  };
  return (
    <Card testId="driver-current-stop">
      <p className="eyebrow">Stop {Math.max(1, stops.findIndex((s) => s.id === current.id) + 1)} of {route.totalStops}</p>
      <h2 className="mt-1 text-2xl font-extrabold text-primary" data-testid="driver-current-clinic">{clinic.name}</h2>
      <p className="text-sm text-muted-foreground">{clinic.address} • {clinic.eircode}</p>
      <div className="mt-3 grid gap-1.5">
        {(current.deliveries || []).map((d) => <div key={d.caseNumber} className="rounded-lg bg-accent/60 px-3 py-2 text-sm">Delivery • Case <b className="font-mono">{d.caseNumber}</b></div>)}
        {(current.collections || []).map((c, i) => <div key={i} className="rounded-lg bg-muted px-3 py-2 text-sm">Collection{c.notes && ` • ${c.notes}`}</div>)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12" onClick={() => openMaps(clinic)} data-testid="driver-navigate"><Navigation /> Navigate</Button>
        <Button className="h-12" disabled={current.arrived || !started} onClick={arrive} data-testid="driver-arrived">{current.arrived ? "Arrived ✓" : "Arrived"}</Button>
        {current.deliveries?.length > 0 && <Button className="h-12 bg-secondary hover:bg-secondary/90" disabled={current.deliveryCompleted || !current.arrived || !started} onClick={() => confirm("delivery")} data-testid="driver-delivered">{current.deliveryCompleted ? "Delivered ✓" : "Delivered"}</Button>}
        {current.collections?.length > 0 && <Button className="h-12 bg-secondary hover:bg-secondary/90" disabled={current.collectionCompleted || !current.arrived || !started} onClick={() => confirm("collection")} data-testid="driver-collected">{current.collectionCompleted ? "Collected ✓" : "Collected"}</Button>}
      </div>
    </Card>
  );
}

/** Route in progress (started or on break): current stop actions, full timeline and break toggle. */
export function ActiveMission({ route, flow, stops, current, completed, alerts }) {
  const started = route.status === "started";
  return (
    <>
      {alerts}
      <MissionHero title="Today's Mission" text={`${route.totalStops} stops • ${completed} completed • ${started ? "started" : "on break"}`}
        note={started ? "Live location shared with clinic tracking pages" : "Route paused — clinics see “temporarily paused”"} />
      <Tabs value={flow.view} onValueChange={flow.setView}>
        <TabsList className="grid w-full grid-cols-2" data-testid="driver-view-tabs">
          <TabsTrigger value="current" data-testid="driver-tab-current">Current Stop</TabsTrigger>
          <TabsTrigger value="full" data-testid="driver-tab-full">Full Route</TabsTrigger>
        </TabsList>
      </Tabs>
      {flow.view === "current" ? <CurrentStop route={route} stops={stops} current={current} /> : <Card><RouteTimeline stops={stops} current={current} /></Card>}
      {started
        ? <Button variant="outline" className="h-12 w-full" onClick={() => notifyError("Route status is not connected to server storage.")} data-testid="driver-break"><Coffee /> Start Break</Button>
        : <Button className="h-12 w-full" onClick={() => notifyError("Route status is not connected to server storage.")} data-testid="driver-resume"><Play /> Resume Route</Button>}
    </>
  );
}
