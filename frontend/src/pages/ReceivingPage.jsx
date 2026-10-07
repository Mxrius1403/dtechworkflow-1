import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaseCard } from "@/components/cases/CaseCard";
import { ReceivingCaseDialog } from "@/components/cases/ReceivingCaseDialog";
import { ReceivingWizard } from "@/components/cases/ReceivingWizard";
import { Muted } from "@/components/common/Bits";
import { Panel } from "@/components/common/Panel";
import { ScanBar } from "@/components/common/ScanBar";
import { DEPARTMENT_STYLE } from "@/config/statuses";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { DEPARTMENTS, caseDepartment, casePlace, departmentName, receivingOutcome, scheduledKey } from "@/lib/cases";
import { createReceivedCase, deleteReceivedCase, restoreReceivedCase, updateCaseAttention, updateReceivedCase } from "@/lib/api";
import { nice } from "@/lib/format";
import { notify, notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";

const PROMPTS = {
  duplicate: (p, techName) => ({ title: "Case already registered", text: <>Case <b>{p.code}</b> is already in <b>{casePlace(p.caseItem, techName)}</b>.</> }),
  removed: (p) => ({ title: "Case removed from queue", text: <>Case <b>{p.code}</b> remains in history. Restore it to the active queue?</>, confirm: "Restore to Queue" }),
  reentry: (p) => ({ title: "Completed case found", text: <>Case <b>{p.code}</b> is completed. Do you want to create a new re-entry?</>, confirm: "Yes, re-enter" }),
};

function ReceivingPrompt({ prompt, onClose, onConfirm, saving }) {
  const { techName } = useData();
  const view = PROMPTS[prompt.kind](prompt, techName);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid={`receiving-prompt-${prompt.kind}`}>
        <DialogHeader><DialogTitle>{view.title}</DialogTitle><DialogDescription>{view.text}</DialogDescription></DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid="receiving-prompt-close">{view.confirm ? "Cancel" : "OK"}</Button>
          {view.confirm && <Button onClick={onConfirm} disabled={saving} data-testid="receiving-prompt-confirm">{saving ? "Saving…" : view.confirm}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReceivingPage() {
  const { cases } = useData();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState(null);
  const [draft, setDraft] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [saving, setSaving] = useState(false);
  const departments = DEPARTMENTS;
  const selectedCase = cases.find((caseItem) => caseItem.id === selectedCaseId);

  const updateCase = async (caseId, changes, save) => {
    try {
      await save(caseId, changes);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Case ${cases.find((caseItem) => caseItem.id === caseId)?.code || ""} updated`);
      return true;
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not update the case");
      return false;
    }
  };

  const receive = (department) => (value) => {
    const result = receivingOutcome(cases, value);
    if (result.kind === "error") return notifyError(result.message);
    if (result.kind === "new") return setDraft({ code: result.code, department, reentry: false });
    setPrompt({ ...result, department });
  };
  const confirmPrompt = async () => {
    if (prompt.kind !== "removed") {
      setDraft({ code: prompt.code, department: prompt.department, reentry: true, caseId: prompt.caseItem.id });
      setPrompt(null);
      return;
    }
    setSaving(true);
    try {
      await restoreReceivedCase(prompt.caseItem.id);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Case ${prompt.code} restored to the queue`);
      setPrompt(null);
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not restore the case");
    } finally {
      setSaving(false);
    }
  };
  const saveDraft = async (details) => {
    try {
      const createdCase = await createReceivedCase({
        ...details,
        code: draft.code,
        department: draft.department,
        caseId: draft.caseId || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Case ${draft.code} due by ${nice(details.productionDate)}`);
      setSelectedCaseId(createdCase.id);
      setDraft(null);
      return true;
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not save the received case");
      return false;
    }
  };
  const removeCase = async (caseId) => {
    try {
      const code = cases.find((caseItem) => caseItem.id === caseId)?.code || "";
      await deleteReceivedCase(caseId);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Case ${code} deleted`);
      setSelectedCaseId(null);
      return true;
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not delete the case");
      return false;
    }
  };

  return (
    <div className={cn("grid min-w-0 gap-5", departments.length > 1 && "xl:grid-cols-3")}>
      {departments.map((dep) => {
        const name = departmentName(dep);
        const byStatus = {
          queue: cases.filter((c) => !c.deleted && c.status === "queue" && caseDepartment(c) === dep)
            .sort((a, b) => scheduledKey(a).localeCompare(scheduledKey(b))),
          production: cases.filter((c) => !c.deleted && c.status === "production" && caseDepartment(c) === dep)
            .sort((a, b) => scheduledKey(a).localeCompare(scheduledKey(b))),
          completed: cases.filter((c) => !c.deleted && c.status === "completed" && caseDepartment(c) === dep)
            .sort((a, b) => String(b.finishedAt || b.updatedAt || "").localeCompare(String(a.finishedAt || a.updatedAt || ""))),
        };
        const sections = [["queue", "In Queue"], ["production", "In Production"], ["completed", "Completed"]];
        return (
          <Panel key={dep} eyebrow={<span className={DEPARTMENT_STYLE[dep].text}>{name}</span>} title={`Receive ${name}`} description="Scan new cases or open a case below to update its workflow details." className={cn("flex min-h-0 min-w-0 flex-col border-l-4", DEPARTMENT_STYLE[dep].ring)} data-testid={`receiving-${dep}`}>
            <ScanBar placeholder={`Scan ${name.toLowerCase()} case`} buttonLabel="Receive" onScan={receive(dep)} testId={`receive-${dep}`} />
            {sections.map(([key, label]) => (
              <section key={key} className="mt-5 flex min-h-0 flex-1 flex-col" aria-label={`${label} ${name} cases`}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label} — {name} ({byStatus[key].length})</h3>
                <div className="grid min-h-0 min-w-0 max-h-[min(36rem,70vh)] flex-1 content-start gap-2 overflow-y-auto">
                  {byStatus[key].map((caseItem) => <CaseCard key={caseItem.id} c={caseItem} onClick={() => setSelectedCaseId(caseItem.id)} />)}
                  {!byStatus[key].length && <Muted>No {label.toLowerCase()} {name.toLowerCase()} cases.</Muted>}
                </div>
              </section>
            ))}
          </Panel>
        );
      })}
      {prompt && <ReceivingPrompt prompt={prompt} onClose={() => setPrompt(null)} onConfirm={confirmPrompt} saving={saving} />}
      {draft && <ReceivingWizard draft={draft} onClose={() => setDraft(null)} onSave={saveDraft} />}
      {selectedCase && <ReceivingCaseDialog
        key={selectedCase.id}
        c={selectedCase}
        canDelete={user.isManager || user.role === "technician"}
        onClose={() => setSelectedCaseId(null)}
        onSave={(changes) => updateCase(selectedCase.id, changes, updateReceivedCase)}
        onAttentionSave={(attention) => updateCase(selectedCase.id, attention, updateCaseAttention)}
        onDelete={() => removeCase(selectedCase.id)}
      />}
    </div>
  );
}
