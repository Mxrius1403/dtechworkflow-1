import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { nice, plural } from "@/lib/format";
import { workingDaysBetween } from "@/lib/holidays";

/** One holiday request line; action buttons are passed as children. */
export function LeaveRow({ r, showName = true, children }) {
  const { techName } = useData();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" data-testid={`leave-row-${r.id}`}>
      <div className="min-w-0">
        <p className="font-semibold text-primary">
          {showName ? <>{r.technicianId} — {techName(r.technicianId, r.technicianName)}</> : <>{nice(r.from)} — {nice(r.to)}</>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {showName && <span>{nice(r.from)} to {nice(r.to)} •</span>}
          <span>{plural(workingDaysBetween(r.from, r.to), "working day")}</span>
          <StatusBadge kind="leave" value={r.status} testId={`leave-status-${r.id}`} />
          {r.rejectionReason && <span>• {r.rejectionReason}</span>}
        </p>
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}
