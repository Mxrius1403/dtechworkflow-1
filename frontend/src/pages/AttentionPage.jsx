import { Button } from "@/components/ui/button";
import { useCaseDialogs } from "@/components/cases/CaseDialogsProvider";
import { OverdueSchedule } from "@/components/cases/OverdueSchedule";
import { Muted } from "@/components/common/Bits";
import { Panel } from "@/components/common/Panel";
import { StatCard } from "@/components/common/StatCard";
import { CountPill } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { attentionGroups, scheduledKey, serviceLabel } from "@/lib/cases";
import { nice } from "@/lib/format";
import { cn } from "@/lib/utils";

function AttentionList({ title, rows, edge, testId }) {
  const { techName } = useData();
  const { openCase, openAttention } = useCaseDialogs();
  return (
    <Panel title={<span className="flex items-center gap-2">{title} <CountPill>{rows.length}</CountPill></span>} data-testid={testId}>
      <div className="grid gap-2">
        {rows.map((c) => (
          <div key={c.id} className={cn("flex flex-wrap items-start justify-between gap-3 rounded-lg border border-l-4 p-3", edge)} data-testid={`${testId}-row-${c.code}`}>
            <div className="min-w-0 flex-1">
              <p className="font-mono font-bold text-primary">{c.code}</p>
              <p className="text-xs text-muted-foreground">{serviceLabel(c)} • Due {nice(scheduledKey(c))}{c.technicianId && ` • ${techName(c.technicianId, c.technician)}`}</p>
              {c.overdue && <OverdueSchedule c={c} />}
              {c.attentionNote && <p className="mt-1.5 text-sm">{c.attentionNote}</p>}
              {c.overdueReason ? <p className="mt-1.5 text-sm"><b>Overdue reason:</b> {c.overdueReason}</p>
                : c.overdueReasonRequired && <p className="mt-1.5 text-sm font-semibold text-rose-700">Overdue reason required</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openCase(c.id)} data-testid={`${testId}-open-${c.code}`}>Open</Button>
              <Button size="sm" variant="outline" onClick={() => openAttention(c.id)} data-testid={`${testId}-status-${c.code}`}>Status</Button>
            </div>
          </div>
        ))}
        {!rows.length && <Muted>None.</Muted>}
      </div>
    </Panel>
  );
}

export default function AttentionPage() {
  const { cases } = useData();
  const g = attentionGroups(cases);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Due Today" value={g.due.length} accent="teal" testId="attention-kpi-due" />
        <StatCard label="On Hold" value={g.holds.length} accent="amber" testId="attention-kpi-hold" />
        <StatCard label="Need Information" value={g.info.length} accent="indigo" testId="attention-kpi-info" />
        <StatCard label="Overdue" value={g.overdue.length} accent="rose" testId="attention-kpi-overdue" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <AttentionList title="Due Today" rows={g.due} edge="border-l-teal-500" testId="attention-due" />
        <div className="grid content-start gap-4">
          <AttentionList title="Overdue Cases" rows={g.overdue} edge="border-l-rose-500" testId="attention-overdue" />
          <AttentionList title="On Hold" rows={g.holds} edge="border-l-amber-400" testId="attention-hold" />
          <AttentionList title="Need Information" rows={g.info} edge="border-l-indigo-500" testId="attention-info" />
        </div>
      </div>
    </>
  );
}
