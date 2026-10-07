import { Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { Panel } from "@/components/common/Panel";
import { StatCard, StatGrid } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { INSIGHT_TONE } from "@/config/statuses";
import { DEPARTMENTS, departmentName } from "@/lib/cases";
import { dateKey, formatDuration, minutesBetween, nice, timeOf } from "@/lib/format";
import { printHtml, reportPdfHtml } from "@/lib/print";
import { cn } from "@/lib/utils";

export function InsightList({ insights, testId }) {
  return (
    <div className="grid gap-1.5" data-testid={testId}>
      {insights.map((i, n) => <p key={n} className={cn("rounded-lg border px-3 py-2 text-sm", INSIGHT_TONE[i.type])}>{i.text}</p>)}
    </div>
  );
}

const delivery = (c) => (c.code === "OW" ? <span className="text-xs text-muted-foreground">Other Work</span> : <StatusBadge kind="flag" value={c.overdue ? "overdue" : "ontime"} />);

function TechnicianSection({ t }) {
  return (
    <div className="rounded-xl border p-4" data-testid={`report-tech-${t.id}`}>
      <h3 className="mb-3 flex flex-wrap items-center gap-2 text-base font-bold text-primary">
        <span className="rounded-md bg-primary px-2 py-0.5 font-mono text-xs text-white">{t.id}</span> {t.name}
        <span className="text-xs font-medium text-muted-foreground">{departmentName(t.department)}</span>
      </h3>
      <InsightList insights={t.insights} />
      <div className="mt-3">
        <DataTable dense rows={t.cases} rowKey={(c) => `${c.caseId || c.id}-${c.sessionIndex || ""}-${c.startedAt}`} columns={[
          { key: "code", header: "Case", render: (c) => <span className="font-mono font-bold">{c.code}{c.code === "OW" && <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">{c.activity || "Other Work"}</span>}</span> },
          { key: "date", header: "Date", render: (c) => nice(c.finishedDate || dateKey(c.finishedAt)) },
          { key: "started", header: "Started", render: (c) => c.startedTime || timeOf(c.startedAt) },
          { key: "finished", header: "Completed", render: (c) => c.finishedTime || timeOf(c.finishedAt) },
          { key: "duration", header: "Duration", render: (c) => formatDuration(minutesBetween(c.startedAt, c.finishedAt)) },
          { key: "delivery", header: "Delivery", render: delivery },
        ]} />
      </div>
      <p className="mt-2 text-sm"><b>Total completed:</b> {t.total} • <b>Overdue:</b> {t.overdue} • <b>Average:</b> {formatDuration(t.avgMinutes)}</p>
    </div>
  );
}

export function ReportPreview({ report: r, onSave, saving = false }) {
  return (
    <Panel title="Report Preview" description={`${nice(r.from)} to ${nice(r.to)}`} data-testid="report-preview" actions={<>
      <Button onClick={() => printHtml(reportPdfHtml(r))} data-testid="report-print"><Printer /> Print / Save PDF</Button>
      <Button variant="outline" onClick={onSave} disabled={saving} data-testid="report-save"><Save /> {saving ? "Saving…" : "Save Report"}</Button>
    </>}>
      <StatGrid>
        <StatCard label="Total Services" value={r.cases.length} testId="report-kpi-total" />
        <StatCard label="Completed" value={r.completed.length} accent="emerald" testId="report-kpi-completed" />
        <StatCard label="Overdue" value={r.overdue.length} accent="rose" testId="report-kpi-overdue" />
        <StatCard label="Average Time" value={formatDuration(r.avgAll)} accent="teal" testId="report-kpi-average" />
        <StatCard label="Technicians" value={r.byTech.length} accent="indigo" testId="report-kpi-techs" />
      </StatGrid>
      <h3 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wider text-primary">Department Production Insights</h3>
      <div className="grid gap-4 xl:grid-cols-3">
        {DEPARTMENTS.map((dep) => (
          <div key={dep} className="rounded-xl border p-4">
            <h4 className="mb-2 font-bold text-primary">{departmentName(dep)}</h4>
            <InsightList insights={r.departmentInsights[dep]} testId={`report-insights-${dep}`} />
          </div>
        ))}
      </div>
      <h3 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wider text-primary">Insights and Detail by Technician</h3>
      <div className="grid gap-4">{r.byTech.map((t) => <TechnicianSection key={t.id} t={t} />)}</div>
    </Panel>
  );
}
