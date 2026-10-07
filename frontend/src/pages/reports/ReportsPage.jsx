import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Muted } from "@/components/common/Bits";
import { Field } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { fetchAllData, saveReport } from "@/lib/api";
import { endOfWeekKey, monthRange, startOfWeekKey } from "@/lib/format";
import { notify, notifyError } from "@/lib/notify";
import { buildReport } from "@/lib/reports";
import { ReportPreview } from "./ReportPreview";
import { SavedReports } from "./SavedReports";

const thisWeek = () => ({ from: startOfWeekKey(), to: endOfWeekKey() });

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState(thisWeek);
  const [preview, setPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setRange({ ...range, [key]: e.target.value });
  const generate = async () => {
    if (!range.from || !range.to || range.from > range.to) return notifyError("Choose a valid period");
    setGenerating(true);
    try {
      const freshData = await queryClient.fetchQuery({
        queryKey: ["data"],
        queryFn: fetchAllData,
        staleTime: 0,
      });
      setPreview(buildReport(freshData, range.from, range.to));
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not refresh report data");
    } finally {
      setGenerating(false);
    }
  };
  const save = async () => {
    setSaving(true);
    try {
      await saveReport({
        from: preview.from,
        to: preview.to,
        title: "Production Report",
        data: preview,
      });
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify("Report saved");
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not save the report");
    } finally {
      setSaving(false);
    }
  };
  const month = () => {
    const [from, to] = monthRange();
    setRange({ from, to });
  };

  return (
    <>
      <Panel title="Smart Production Reports" description="Only Manager-confirmed production is counted. Ortho Other Work appears as OW.">
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Field label="From"><Input type="date" value={range.from} onChange={set("from")} data-testid="report-from" /></Field>
          <Field label="To"><Input type="date" value={range.to} onChange={set("to")} data-testid="report-to" /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={generate} disabled={generating} data-testid="report-generate"><BarChart3 /> {generating ? "Refreshing data…" : "Generate Preview"}</Button>
          <Button variant="outline" onClick={() => setRange(thisWeek())} data-testid="report-this-week">This Week</Button>
          <Button variant="outline" onClick={month} data-testid="report-this-month">This Month</Button>
        </div>
      </Panel>
      {preview ? <ReportPreview report={preview} onSave={save} saving={saving} /> : (
        <Panel><Muted>Choose a period and generate the report to see Smart Insights and the complete PDF structure.</Muted></Panel>
      )}
      <SavedReports />
    </>
  );
}
