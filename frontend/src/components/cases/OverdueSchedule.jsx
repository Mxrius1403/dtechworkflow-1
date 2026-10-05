import { overdueSummary } from "@/lib/cases";
import { nice, plural } from "@/lib/format";

export function OverdueSchedule({ c }) {
  const s = overdueSummary(c);
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-rose-200 bg-rose-50/60 px-2.5 py-1.5 text-xs text-rose-900" data-testid={`overdue-schedule-${c.code}`}>
      <span><b>Original due:</b> {nice(s.original)}</span>
      <span><b>{s.completed ? "Completed" : "Rescheduled to"}:</b> {nice(s.comparison)}</span>
      <strong>{plural(s.days, "calendar day")} overdue</strong>
    </div>
  );
}
