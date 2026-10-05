import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEPARTMENT_STYLE } from "@/config/statuses";
import { useData } from "@/context/DataContext";
import { DEPARTMENTS, caseDepartment, departmentName, todayCases } from "@/lib/cases";
import { niceToday } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLUMNS = [["queue", "Queue"], ["production", "Production"], ["completed", "Completed"]];

/** Wall display: the three department boards in large, high-contrast type. */
export function TvBoard({ onExit }) {
  const { cases } = useData();
  const rows = todayCases(cases);
  return (
    <div className="flex min-h-screen flex-col gap-5 bg-[#040e30] p-6 text-white" data-testid="tv-board">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow !text-teal-300">Dentaltech • Daily Flow</p>
          <h1 className="text-3xl font-extrabold">Production Board — {niceToday()}</h1>
        </div>
        <Button variant="secondary" onClick={onExit} data-testid="tv-exit-button"><X /> Exit TV Mode</Button>
      </div>
      <div className="grid flex-1 gap-5 xl:grid-cols-3">
        {DEPARTMENTS.map((dep) => {
          const own = rows.filter((c) => caseDepartment(c) === dep);
          return (
            <section key={dep} className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold"><span className={cn("h-3 w-3 rounded-full", DEPARTMENT_STYLE[dep].dot)} />{departmentName(dep)}</h2>
              <div className="grid flex-1 grid-cols-3 gap-3">
                {COLUMNS.map(([status, label]) => {
                  const items = own.filter((c) => c.status === status);
                  return (
                    <div key={status} className="rounded-xl bg-black/20 p-3">
                      <p className="mb-2 flex justify-between text-xs font-bold uppercase tracking-widest text-white/60">{label}<span className="font-mono text-white">{items.length}</span></p>
                      <div className="grid gap-2">
                        {items.map((c) => (
                          <div key={c.id} className={cn("rounded-lg px-2.5 py-2 font-mono text-xl font-bold", c.overdue && c.status !== "completed" ? "bg-rose-500/90" : "bg-white/10")}>{c.code}</div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
