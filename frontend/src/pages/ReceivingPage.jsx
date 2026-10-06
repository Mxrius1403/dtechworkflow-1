import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaseCard } from "@/components/cases/CaseCard";
import { ReceivingWizard } from "@/components/cases/ReceivingWizard";
import { Muted } from "@/components/common/Bits";
import { Panel } from "@/components/common/Panel";
import { ScanBar } from "@/components/common/ScanBar";
import { DEPARTMENT_STYLE } from "@/config/statuses";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { DEPARTMENTS, caseDepartment, casePlace, departmentName, receivingOutcome, scheduledKey } from "@/lib/cases";
import { createReceivedCase, restoreReceivedCase } from "@/lib/api";
import { nice, today } from "@/lib/format";
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
  const [saving, setSaving] = useState(false);
  const departments = user.isManager ? DEPARTMENTS : ["digital"];

  const receive = (department) => (value) => {
    const result = receivingOutcome(cases, value);
    if (result.kind === "error") return notifyError(result.message);
    if (result.kind === "new") return setDraft({ code: result.code, department, reentry: false });
    if (!user.isManager && caseDepartment(result.caseItem) !== department) {
      return notifyError(`This case belongs to ${departmentName(caseDepartment(result.caseItem))}.`);
    }
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
      await createReceivedCase({
        ...details,
        code: draft.code,
        department: draft.department,
        caseId: draft.caseId || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`Case ${draft.code} scheduled for ${nice(details.productionDate)}`);
      setDraft(null);
      return true;
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not save the received case");
      return false;
    }
  };

  return (
    <div className={cn("grid gap-5", departments.length > 1 && "xl:grid-cols-3")}>
      {departments.map((dep) => {
        const name = departmentName(dep);
        const upcoming = cases.filter((c) => c.status === "queue" && caseDepartment(c) === dep && scheduledKey(c) >= today())
          .sort((a, b) => scheduledKey(a).localeCompare(scheduledKey(b))).slice(0, 12);
        return (
          <Panel key={dep} eyebrow={<span className={DEPARTMENT_STYLE[dep].text}>{name}</span>} title={`Receive ${name}`} description="Scan a case, choose its work details and schedule its production date." className={cn("border-l-4", DEPARTMENT_STYLE[dep].ring)} data-testid={`receiving-${dep}`}>
            <ScanBar placeholder={`Scan ${name.toLowerCase()} case`} buttonLabel="Receive" onScan={receive(dep)} testId={`receive-${dep}`} />
            <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Upcoming — {name}</h3>
            <div className="grid gap-2">
              {upcoming.map((c) => <CaseCard key={c.id} c={c} showWho={false} />)}
              {!upcoming.length && <Muted>No upcoming {name.toLowerCase()} cases.</Muted>}
            </div>
          </Panel>
        );
      })}
      {prompt && <ReceivingPrompt prompt={prompt} onClose={() => setPrompt(null)} onConfirm={confirmPrompt} saving={saving} />}
      {draft && <ReceivingWizard draft={draft} onClose={() => setDraft(null)} onSave={saveDraft} />}
    </div>
  );
}
