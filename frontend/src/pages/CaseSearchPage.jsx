import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCaseDialogs } from "@/components/cases/CaseDialogsProvider";
import { DataTable } from "@/components/common/DataTable";
import { Field, NativeSelect } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { CountPill, StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { caseDepartment, departmentName, sessionHistoryRows } from "@/lib/cases";
import { endOfWeekKey, formatDuration, minutesBetween, shortDate, startOfWeekKey } from "@/lib/format";

const EMPTY = { query: "", status: "all", from: "", to: "" };
const relevantDate = (c) => (c.finishedAt || c.startedAt || c.receivedAt || c.receivedDate || "").slice(0, 10);
const inPeriod = (d, f) => (!f.from || d >= f.from) && (!f.to || d <= f.to);

export default function CaseSearchPage() {
  const { cases, techName } = useData();
  const { openCase } = useCaseDialogs();
  const [form, setForm] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const apply = (next) => { setForm(next); setFilters(next); };

  const q = filters.query.toLowerCase();
  const rows = cases.filter((c) => !c.deleted && inPeriod(relevantDate(c), filters) && (filters.status === "all" || c.status === filters.status)
    && (!q || `${c.code} ${c.technician || ""} ${c.finishedBy || ""} ${c.technicianId || ""} ${c.finishedById || ""}`.toLowerCase().includes(q)))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const history = rows.flatMap(sessionHistoryRows).filter((s) => inPeriod(s.date || "", filters));
  const who = (id, fallback) => <>{techName(id, fallback || "-")}{id && <span className="ml-1 font-mono text-[11px] text-muted-foreground">({id})</span>}</>;

  return (
    <>
      <Panel title="Find and Correct Cases" description="Search the complete case history. Every production cycle stays listed separately when the same case number returns on another date.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Case number / technician"><Input value={form.query} onChange={set("query")} onKeyDown={(e) => e.key === "Enter" && setFilters(form)} placeholder="Example: 4101 or Liam" data-testid="case-search-query" /></Field>
          <Field label="Current status">
            <NativeSelect value={form.status} onChange={set("status")} data-testid="case-search-status">
              <option value="all">All statuses</option><option value="queue">Queue</option><option value="production">In Production</option><option value="completed">Completed</option><option value="removed">Removed</option>
            </NativeSelect>
          </Field>
          <Field label="From"><Input type="date" value={form.from} onChange={set("from")} data-testid="case-search-from" /></Field>
          <Field label="To"><Input type="date" value={form.to} onChange={set("to")} data-testid="case-search-to" /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setFilters(form)} data-testid="case-search-submit">Search</Button>
          <Button variant="outline" onClick={() => apply({ ...EMPTY })} data-testid="case-search-all-dates">All Dates</Button>
          <Button variant="outline" onClick={() => apply({ ...form, from: startOfWeekKey(), to: endOfWeekKey() })} data-testid="case-search-this-week">This Week</Button>
        </div>
      </Panel>
      <Panel title="Production History" actions={<CountPill testId="history-count">{history.length}</CountPill>}>
        <DataTable dense testId="history-table" rows={history} rowKey={(r) => r.key} empty="No production sessions found." columns={[
          { key: "code", header: "Case", render: (s) => <span className="font-mono font-bold">{s.code}</span> },
          { key: "date", header: "Date", render: (s) => shortDate(s.date) },
          { key: "startedTime", header: "Started", render: (s) => s.startedTime || "-" },
          { key: "finishedTime", header: "Finished", render: (s) => s.finishedTime || "-" },
          { key: "time", header: "Time", render: (s) => (s.startedAt && s.finishedAt ? formatDuration(minutesBetween(s.startedAt, s.finishedAt)) : "-") },
          { key: "tech", header: "Technician", render: (s) => who(s.technicianId, s.technician) },
        ]} />
      </Panel>
      <Panel title="Current Case Records" actions={<CountPill testId="records-count">{rows.length}</CountPill>}>
        <DataTable dense testId="records-table" rows={rows} empty="No cases found." rowTestId={(c) => `record-row-${c.code}`} columns={[
          { key: "code", header: "Case", render: (c) => <span className="font-mono font-bold">{c.code}</span> },
          { key: "department", header: "Department", render: (c) => departmentName(caseDepartment(c)) },
          { key: "status", header: "Status", render: (c) => <StatusBadge kind="case" value={c.status} /> },
          { key: "tech", header: "Technician", render: (c) => who(c.technicianId || c.finishedById, c.technician || c.finishedBy) },
          { key: "received", header: "Received", render: (c) => `${c.receivedDate || "-"} ${c.receivedTime || ""}` },
          { key: "started", header: "Started", render: (c) => c.startedTime || "-" },
          { key: "finished", header: "Completed", render: (c) => c.finishedTime || "-" },
          { key: "overdue", header: "Overdue", render: (c) => (c.overdue && c.status !== "completed" ? <StatusBadge kind="flag" value="overdue" /> : "No") },
          { key: "manage", header: "", render: (c) => <Button size="sm" onClick={() => openCase(c.id)} data-testid={`record-manage-${c.code}`}>Manage</Button> },
        ]} />
      </Panel>
    </>
  );
}
