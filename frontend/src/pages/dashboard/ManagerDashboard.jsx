import { Link } from "react-router-dom";
import { CalendarDays, CheckCircle2, Inbox, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaseBoard, splitByStatus } from "@/components/cases/CaseBoard";
import { CaseCard } from "@/components/cases/CaseCard";
import { useCaseDialogs } from "@/components/cases/CaseDialogsProvider";
import { StatCard } from "@/components/common/StatCard";
import { DEPARTMENT_STYLE } from "@/config/statuses";
import { useData } from "@/context/DataContext";
import { DEPARTMENTS, attentionGroups, caseDepartment, completionReviewCases, departmentName, todayCases } from "@/lib/cases";
import { cn } from "@/lib/utils";

const codes = (rows) => rows.slice(0, 8).map((c) => c.code).join(", ") + (rows.length > 8 ? "…" : "") || "None";

function DepartmentSection({ department, cases }) {
  const { openCase } = useCaseDialogs();
  const split = splitByStatus(cases);
  const style = DEPARTMENT_STYLE[department];
  return (
    <section className={cn("fade-up rounded-xl border border-l-4 bg-card p-4 shadow-sm sm:p-5", style.ring)} data-testid={`department-section-${department}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cn("text-lg font-bold", style.text)}>{departmentName(department)}</h2>
          <p className="text-xs text-muted-foreground">Queue, production and completed cases</p>
        </div>
        <div className="flex gap-2 text-xs font-semibold text-muted-foreground">
          <span>{split.queue.length} Queue</span>•<span>{split.production.length} Production</span>•<span>{split.completed.length} Completed</span>
        </div>
      </div>
      <CaseBoard {...split} testId={`board-${department}`} renderCard={(c) => <CaseCard key={c.id} c={c} onClick={() => openCase(c.id)} />} />
    </section>
  );
}

export function ManagerDashboard() {
  const { cases } = useData();
  const groups = attentionGroups(cases);
  const reviews = completionReviewCases(cases).length;
  const today = todayCases(cases);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Services due today" value={groups.due.length} hint={codes(groups.due)} accent="teal" testId="hero-due-today" />
        <StatCard label="On hold" value={groups.holds.length} hint={codes(groups.holds)} accent="amber" testId="hero-on-hold" />
        <StatCard label="Need information" value={groups.info.length} hint={codes(groups.info)} accent="indigo" testId="hero-need-info" />
        <StatCard label="Overdue" value={groups.overdue.length} hint={codes(groups.overdue)} accent="rose" testId="hero-overdue" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild data-testid="shortcut-receiving"><Link to="/receiving"><Inbox /> Open Receiving</Link></Button>
        <Button asChild className="bg-secondary hover:bg-secondary/90" data-testid="shortcut-completion-review"><Link to="/completion-review"><CheckCircle2 /> Completion Review{reviews ? ` (${reviews})` : ""}</Link></Button>
        <Button asChild variant="outline" data-testid="shortcut-attention"><Link to="/attention"><TriangleAlert /> Cases Needing Attention</Link></Button>
        <Button asChild variant="outline" data-testid="shortcut-calendar"><Link to="/calendar"><CalendarDays /> Production Calendar</Link></Button>
      </div>
      {DEPARTMENTS.map((dep) => <DepartmentSection key={dep} department={dep} cases={today.filter((c) => caseDepartment(c) === dep)} />)}
    </>
  );
}
