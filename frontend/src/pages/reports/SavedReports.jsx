import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Muted } from "@/components/common/Bits";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { Panel } from "@/components/common/Panel";
import { useQueryClient } from "@tanstack/react-query";
import { useData } from "@/context/DataContext";
import { deleteReport } from "@/lib/api";
import { dateTimeOf, nice } from "@/lib/format";
import { notify, notifyError } from "@/lib/notify";
import { printHtml, reportPdfHtml } from "@/lib/print";

/** Saved reports are always listed (the original only showed them after generating a preview). */
export function SavedReports() {
  const data = useData();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState(null);
  const rows = [...data.reports].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const remove = async (reportId) => {
    setDeletingId(reportId);
    try {
      await deleteReport(reportId);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify("Saved report deleted");
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not delete the saved report");
    } finally {
      setDeletingId(null);
    }
  };
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
              <Button size="sm" variant="outline" disabled={!r.data} onClick={() => printHtml(reportPdfHtml(r.data))} data-testid={`saved-report-pdf-${r.id}`}><FileText /> PDF</Button>
              <ConfirmAction title="Delete this saved report?" confirmLabel="Delete" onConfirm={() => remove(r.id)} testId={`saved-report-delete-${r.id}`}>
                <Button size="sm" variant="destructive" disabled={deletingId === r.id} data-testid={`saved-report-delete-button-${r.id}`}><Trash2 /> Delete</Button>
              </ConfirmAction>
            </div>
          </div>
        ))}
        {!rows.length && <Muted>No saved reports yet.</Muted>}
      </div>
    </Panel>
  );
}
