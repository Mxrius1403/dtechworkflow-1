import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CaseControlDialog } from "@/components/cases/CaseControlDialog";
import { useCaseDialogs } from "@/components/cases/CaseDialogsProvider";
import { DataTable } from "@/components/common/DataTable";
import { Field, NativeSelect } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { CountPill, StatusBadge } from "@/components/common/StatusBadge";
import { NOTE_LIMIT } from "@/config/constants";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { updateCaseAttention } from "@/lib/api";
import { caseDepartment, caseSearchRows, departmentName } from "@/lib/cases";
import { notify, notifyError } from "@/lib/notify";

const PAGE_SIZE = 25;

const ATTENTION_LABELS = {
  active: "Active",
  on_hold: "On Hold",
  need_information: "Need Information",
};

function CaseSearchAttentionDialog({ c, onClose, onSave }) {
  const [attentionStatus, setAttentionStatus] = useState(c.attentionStatus || "active");
  const [attentionNote, setAttentionNote] = useState("");
  const [saving, setSaving] = useState(false);

  const saveAttention = async () => {
    if (attentionStatus !== "active" && !attentionNote.trim()) return notifyError("Enter a short reason");
    setSaving(true);
    try {
      if (await onSave({
        attentionStatus,
        attentionNote: attentionNote.trim(),
      })) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid="case-search-attention-dialog">
        <DialogHeader>
          <DialogTitle>Change Attention Status</DialogTitle>
          <DialogDescription>Case {c.code}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Attention status">
            <NativeSelect
              value={attentionStatus}
              onChange={(event) => {
                const nextStatus = event.target.value;
                setAttentionStatus(nextStatus);
                if (nextStatus === "active") setAttentionNote("");
              }}
              data-testid="case-search-attention-status-select"
            >
              {Object.entries(ATTENTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </Field>
          <Field
            label={`Short reason (${attentionStatus === "active" ? "optional" : "required"})`}
            hint={`${attentionNote.length}/${NOTE_LIMIT} characters`}
          >
            <Textarea
              required={attentionStatus !== "active"}
              maxLength={NOTE_LIMIT}
              value={attentionNote}
              onChange={(event) => setAttentionNote(event.target.value)}
              placeholder="Enter a short reason (optional for Active)"
              data-testid="case-search-attention-reason-input"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={saveAttention} disabled={saving} data-testid="case-search-attention-save">
            {saving ? "Saving…" : "Save Attention Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CaseSearchPage() {
  const { cases, techName } = useData();
  const { user } = useSession();
  const { openOverdueReason } = useCaseDialogs();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const rows = useMemo(() => caseSearchRows(cases, query), [cases, query]);
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectedCase = cases.find((caseItem) => caseItem.id === selectedCaseId);
  const who = (id, fallback) => <>{techName(id, fallback || "-")}{id && <span className="ml-1 font-mono text-[11px] text-muted-foreground">({id})</span>}</>;

  const saveAttention = async (attention) => {
    try {
      await updateCaseAttention(selectedCase.id, attention);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Case ${selectedCase.code} updated`);
      return true;
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not update the case");
      return false;
    }
  };

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
          { key: "manage", header: "", render: (c) => c.deleted ? "-" : <Button size="sm" onClick={() => { setSelectedCaseId(c.id); setAttentionOpen(false); }} data-testid={`record-manage-${c.code}`}>Manage</Button> },
        ]} />
      </div>
      {selectedCase && !attentionOpen && (
        <CaseControlDialog
          c={selectedCase}
          canDelete={user?.isManager || user?.isOwner}
          onClose={() => setSelectedCaseId(null)}
          onAttention={() => setAttentionOpen(true)}
          onOverdueReason={() => openOverdueReason(selectedCase.id)}
        />
      )}
      {selectedCase && attentionOpen && (
        <CaseSearchAttentionDialog
          c={selectedCase}
          onClose={() => setAttentionOpen(false)}
          onSave={saveAttention}
        />
      )}
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
