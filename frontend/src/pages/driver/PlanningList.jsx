import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { mapsUrl } from "@/lib/logistics";
import { cn } from "@/lib/utils";

const openMaps = (clinic) => window.open(mapsUrl(clinic), "_blank", "noopener");

/** Re-order clinics: positions before `locked` (current/completed stops) cannot move. */
export function PlanningList({ order, locked, onMove }) {
  const { byId } = useData();
  return (
    <div className="grid gap-2" data-testid="driver-planning-list">
      {order.map((id, index) => {
        const stop = byId.stops[id], clinic = byId.clinics[stop?.clinicId] || {}, isLocked = index < locked;
        const atTop = isLocked || index === locked, atBottom = isLocked || index === order.length - 1;
        return (
          <div key={id} className={cn("rounded-xl border p-3", isLocked ? "bg-muted/60" : "bg-card")} data-testid={`plan-stop-${id}`}>
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary font-mono text-sm font-bold text-white">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 font-semibold text-primary">{clinic.name || stop?.clinicId}{stop?.urgent && <StatusBadge kind="flag" value="urgent" />}</p>
                <p className="text-xs text-muted-foreground">{clinic.address}{clinic.eircode && ` • ${clinic.eircode}`}</p>
                <p className="text-xs">{stop?.deliveries?.length || 0} deliveries • {stop?.collections?.length || 0} collections{isLocked && " • Current/completed position locked"}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={() => openMaps(clinic)} data-testid={`plan-maps-${id}`}><MapPin /> Maps</Button>
              <Button size="sm" variant="outline" disabled={atTop} onClick={() => onMove(index, "first")} data-testid={`plan-first-${id}`}><ChevronsUp /> First available</Button>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={atTop} onClick={() => onMove(index, -1)} data-testid={`plan-up-${id}`}><ArrowUp /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={atBottom} onClick={() => onMove(index, 1)} data-testid={`plan-down-${id}`}><ArrowDown /></Button>
              <Button size="sm" variant="outline" disabled={atBottom} onClick={() => onMove(index, "last")} data-testid={`plan-last-${id}`}><ChevronsDown /> Last</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { openMaps };
