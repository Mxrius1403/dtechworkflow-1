import { Button } from "@/components/ui/button";
import { BackLink, Muted } from "@/components/common/Bits";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { Panel } from "@/components/common/Panel";
import { CountPill } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { completionReviewCases, serviceLabel } from "@/lib/cases";
import { dateTimeOf } from "@/lib/format";
import { notifyError } from "@/lib/notify";

export default function CompletionReviewPage() {
  const { cases, techName } = useData();
  const rows = completionReviewCases(cases);
  return (
    <>
      <BackLink to="/dashboard">Back to Dashboard</BackLink>
      <Panel title="Completion Review" description="Only Manager-confirmed production is included in reports and released for delivery." actions={<CountPill testId="review-count">{rows.length} awaiting</CountPill>}>
        <div className="grid gap-2">
          {rows.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-l-4 border-l-sky-500 p-3" data-testid={`review-row-${c.code}`}>
              <div className="min-w-0">
                <p className="font-mono font-bold text-primary">{c.code}</p>
                <p className="text-xs text-muted-foreground">
                  {serviceLabel(c)} • {techName(c.finishedById || c.technicianId, c.finishedBy)} ({c.finishedById}) • Submitted {dateTimeOf(c.finishedAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => notifyError("Completion review is not connected to server storage.")} data-testid={`review-confirm-${c.code}`}>Confirm Completed</Button>
                <ConfirmAction title="Return this case to the responsible technician?" description="The rejected completion will not appear in reports." confirmLabel="Return case" onConfirm={() => notifyError("Completion review is not connected to server storage.")} testId={`review-return-${c.code}`}>
                  <Button size="sm" variant="destructive" data-testid={`review-return-button-${c.code}`}>Return to Technician</Button>
                </ConfirmAction>
              </div>
            </div>
          ))}
          {!rows.length && <Muted>No completed cases are awaiting confirmation.</Muted>}
        </div>
      </Panel>
    </>
  );
}
