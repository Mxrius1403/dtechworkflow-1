import { Button } from "@/components/ui/button";
import { CaseBoard } from "@/components/cases/CaseBoard";
import { CaseCard } from "@/components/cases/CaseCard";
import { useCaseDialogs } from "@/components/cases/CaseDialogsProvider";
import { ScanBar } from "@/components/common/ScanBar";
import { StatCard, StatGrid } from "@/components/common/StatCard";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { scanOutcome, todayCases } from "@/lib/cases";
import { notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";

export function TechnicianDashboard() {
  const { cases, toothOrders, techName } = useData();
  const { user } = useSession();
  const { openCase, openAttention, openOverdueReason } = useCaseDialogs();
  const rows = todayCases(cases);
  const mine = (c, key) => c[key] === user.id;

  const onScan = (value) => {
    const result = scanOutcome(cases, value, user, techName);
    if (!result) return;
    if (result.kind === "manage") return openCase(result.caseItem.id);
    if (result.kind === "overdueReason") return openOverdueReason(result.caseItem.id);
    if (result.kind === "save") return notifyError("Case workflow actions are not connected to server storage.");
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
        <h2 className="text-2xl font-extrabold text-primary" data-testid="tech-case-scope-title">All Departments</h2>
        <span className="text-sm text-muted-foreground">Case category shown on each case</span>
      </div>
      <StatGrid>
        <StatCard label="In Queue" value={rows.filter((c) => c.status === "queue").length} testId="tech-stat-queue" />
        <StatCard label="In Production" value={rows.filter((c) => c.status === "production").length} accent="teal" testId="tech-stat-production" />
        <StatCard label="Completed" value={rows.filter((c) => c.status === "completed").length} accent="emerald" testId="tech-stat-completed" />
        <StatCard label="Overdue" value={rows.filter((c) => c.overdue && c.status !== "completed").length} accent="rose" testId="tech-stat-overdue" />
        <StatCard label="Pending Tooth Order Requests" value={toothOrders.filter((o) => o.status === "pending").length} accent="indigo" testId="tech-stat-orders" />
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
