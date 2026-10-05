import { weekdayShort } from "@/lib/format";
import { workWeekDates } from "@/lib/logistics";
import { cn } from "@/lib/utils";

export function WorkWeek({ date, routes, onSelect }) {
  return (
    <section className="rounded-2xl border bg-card p-3 shadow-sm" data-testid="driver-work-week">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-sm font-bold text-primary">Work Week</h2>
        <span className="text-[11px] text-muted-foreground">Monday to Friday</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {workWeekDates(date).map((key) => {
          const route = routes.find((r) => r.date === key);
          const done = route?.status === "completed";
          return (
            <button key={key} onClick={() => onSelect(key)} data-testid={`driver-day-${key}`}
              className={cn("flex flex-col items-center rounded-xl border px-1 py-2 transition-colors",
                key === date ? "border-primary bg-primary text-white" : "bg-background hover:border-secondary",
                done && key !== date && "border-emerald-200 bg-emerald-50")}>
              <span className="text-[11px] font-semibold uppercase opacity-80">{weekdayShort(key)}</span>
              <span className="font-mono text-lg font-bold">{key.slice(8)}</span>
              <span className="text-[10px] opacity-80">{done ? "Completed" : route ? "Scheduled" : "—"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
