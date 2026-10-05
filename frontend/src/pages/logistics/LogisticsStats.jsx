import { StatCard, StatGrid } from "@/components/common/StatCard";
import { useData } from "@/context/DataContext";
import { nice, today } from "@/lib/format";
import { ACTIVE_ROUTE_STATUSES, defaultDriverDate, routeStops } from "@/lib/logistics";

/** Today's active routes (next working day at weekends, matching the driver portal). */
export function LogisticsStats() {
  const { routes, drivers, byId } = useData();
  const day = defaultDriverDate();
  const active = routes.filter((r) => r.date === day && ACTIVE_ROUTE_STATUSES.includes(r.status));
  const stops = active.flatMap((r) => routeStops(r, byId.stops));
  const suffix = day === today() ? "Today" : `• ${nice(day)}`;
  return (
    <StatGrid>
      <StatCard label={`Collections ${suffix}`} value={stops.reduce((n, s) => n + (s.collections?.length || 0), 0)} accent="teal" testId="logistics-stat-collections" />
      <StatCard label={`Deliveries ${suffix}`} value={stops.reduce((n, s) => n + (s.deliveries?.length || 0), 0)} accent="indigo" testId="logistics-stat-deliveries" />
      <StatCard label="Completed Stops" value={stops.filter((s) => s.status === "completed").length} accent="emerald" testId="logistics-stat-completed" />
      <StatCard label="Active Routes" value={active.length} accent="sky" testId="logistics-stat-active" />
      <StatCard label="Drivers" value={drivers.length} testId="logistics-stat-drivers" />
    </StatGrid>
  );
}
