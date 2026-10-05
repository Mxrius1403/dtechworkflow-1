import { Button } from "@/components/ui/button";
import { CaseBoard } from "@/components/cases/CaseBoard";
import { CaseCard } from "@/components/cases/CaseCard";
import { useCaseDialogs } from "@/components/cases/CaseDialogsProvider";
import { ScanBar } from "@/components/common/ScanBar";
import { StatCard, StatGrid } from "@/components/common/StatCard";
import { DEPARTMENT_STYLE } from "@/config/statuses";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { caseDepartment, departmentName, scanOutcome, todayCases } from "@/lib/cases";
import { demoSave, notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";

export function TechnicianDashboard() {
  const { cases, toothOrders, techName } = useData();
  const { user } = useSession();
  const { openCase, openAttention, openOverdueReason } = useCaseDialogs();
  const dept = user.department || "denture";
  const rows = todayCases(cases).filter((c) => caseDepartment(c) === dept);
  const mine = (c, key) => c[key] === user.id;

  const onScan = (value) => {
    const result = scanOutcome(cases, value, user, techName);
    if (!result) return;
    if (result.kind === "manage") return openCase(result.caseItem.id);
    if (result.kind === "overdueReason") return openOverdueReason(result.caseItem.id, true);
    if (result.kind === "save") return demoSave(result.message);
    notifyError(result.message);
  };

  const actions = (c) => c.technicianId === user.id && (
    <>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openAttention(c.id)} data-testid={`case-status-button-${c.code}`}>Status</Button>
      {c.overdueReasonRequired && <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => openOverdueReason(c.id)} data-testid={`case-overdue-button-${c.code}`}>Overdue Reason</Button>}
    </>
  );

  return (
    <>
      <div className="flex items-baseline gap-3">
        <span className={cn("h-3 w-3 rounded-full", DEPARTMENT_STYLE[dept].dot)} />
        <h2 className="text-2xl font-extrabold text-primary" data-testid="tech-department-title">{departmentName(dept)}</h2>
        <span className="text-sm text-muted-foreground">Your department</span>
      </div>
      <StatGrid>
        <StatCard label="In Queue" value={rows.filter((c) => c.status === "queue").length} testId="tech-stat-queue" />
        <StatCard label="In Production" value={rows.filter((c) => c.status === "production").length} accent="teal" testId="tech-stat-production" />
        <StatCard label="Completed" value={rows.filter((c) => c.status === "completed").length} accent="emerald" testId="tech-stat-completed" />
        <StatCard label="Overdue" value={rows.filter((c) => c.overdue && c.status !== "completed").length} accent="rose" testId="tech-stat-overdue" />
        <StatCard label="Pending Tooth Orders" value={toothOrders.filter((o) => o.status === "pending").length} accent="indigo" testId="tech-stat-orders" />
      </StatGrid>
      <ScanBar placeholder="Scan case barcode here" onScan={onScan} hint="Queue is shared. Production and Completed show only your work." testId="tech-scan" />
      <CaseBoard
        testId="tech-board"
        queue={rows.filter((c) => c.status === "queue")}
        production={rows.filter((c) => c.status === "production" && mine(c, "technicianId"))}
        completed={rows.filter((c) => c.status === "completed" && mine(c, "finishedById"))}
        renderCard={(c) => <CaseCard key={c.id} c={c} actions={actions(c)} />}
      />
    </>
  );
}
