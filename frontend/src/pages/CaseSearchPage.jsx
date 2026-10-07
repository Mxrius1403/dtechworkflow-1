import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCaseDialogs } from "@/components/cases/CaseDialogsProvider";
import { DataTable } from "@/components/common/DataTable";
import { Field } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { CountPill, StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { caseDepartment, caseSearchRows, departmentName } from "@/lib/cases";

const PAGE_SIZE = 25;

export default function CaseSearchPage() {
  const { cases, techName } = useData();
  const { openCase } = useCaseDialogs();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const rows = useMemo(() => caseSearchRows(cases, query), [cases, query]);
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const who = (id, fallback) => <>{techName(id, fallback || "-")}{id && <span className="ml-1 font-mono text-[11px] text-muted-foreground">({id})</span>}</>;

  return (
    <Panel title="All Cases" description="Search and manage every case, regardless of status." actions={<CountPill testId="records-count">{rows.length}</CountPill>}>
      <Field label="Search cases">
        <Input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setPage(0); }}
          placeholder="Case number, technician or status"
          data-testid="case-search-query"
        />
      </Field>
      <div className="mt-4">
        <DataTable dense testId="records-table" rows={pageRows} empty="No cases found." rowTestId={(c) => `record-row-${c.code}-${c.id}`} columns={[
          { key: "code", header: "Case", render: (c) => <span className="font-mono font-bold">{c.code}</span> },
          { key: "department", header: "Department", render: (c) => departmentName(caseDepartment(c)) },
          { key: "status", header: "Status", render: (c) => <StatusBadge kind="case" value={c.deleted ? "deleted" : c.status} /> },
          { key: "tech", header: "Technician", render: (c) => who(c.technicianId || c.finishedById, c.technician || c.finishedBy) },
          { key: "received", header: "Received", render: (c) => `${c.receivedDate || "-"} ${c.receivedTime || ""}` },
          { key: "started", header: "Started", render: (c) => c.startedTime || "-" },
          { key: "finished", header: "Completed", render: (c) => c.finishedTime || "-" },
          { key: "overdue", header: "Overdue", render: (c) => (c.overdue && c.status !== "completed" ? <StatusBadge kind="flag" value="overdue" /> : "No") },
          { key: "manage", header: "", render: (c) => c.deleted ? "-" : <Button size="sm" onClick={() => openCase(c.id)} data-testid={`record-manage-${c.code}`}>Manage</Button> },
        ]} />
      </div>
      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" aria-label="Previous page" title="Previous page" disabled={page === 0} onClick={() => setPage((current) => current - 1)} data-testid="case-search-previous">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" aria-label="Next page" title="Next page" disabled={page >= pageCount - 1} onClick={() => setPage((current) => current + 1)} data-testid="case-search-next">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
