import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Muted } from "@/components/common/Bits";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { Panel } from "@/components/common/Panel";
import { useData } from "@/context/DataContext";
import { dateTimeOf, nice } from "@/lib/format";
import { demoSave } from "@/lib/notify";
import { printHtml, reportPdfHtml } from "@/lib/print";
import { buildReport } from "@/lib/reports";

/** Saved reports are always listed (the original only showed them after generating a preview). */
export function SavedReports() {
  const data = useData();
  const rows = [...data.reports].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return (
    <Panel title="Saved Reports" data-testid="saved-reports">
      <div className="grid gap-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" data-testid={`saved-report-${r.id}`}>
            <div>
              <p className="font-semibold text-primary">{r.title}</p>
              <p className="text-xs text-muted-foreground">{nice(r.from)} to {nice(r.to)} • saved {dateTimeOf(r.createdAt)}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => printHtml(reportPdfHtml(r.data || buildReport(data, r.from, r.to)))} data-testid={`saved-report-pdf-${r.id}`}><FileText /> PDF</Button>
              <ConfirmAction title="Delete this saved report?" confirmLabel="Delete" onConfirm={() => demoSave("Saved report deleted")} testId={`saved-report-delete-${r.id}`}>
                <Button size="sm" variant="destructive" data-testid={`saved-report-delete-button-${r.id}`}><Trash2 /> Delete</Button>
              </ConfirmAction>
            </div>
          </div>
        ))}
        {!rows.length && <Muted>No saved reports yet.</Muted>}
      </div>
    </Panel>
  );
}
