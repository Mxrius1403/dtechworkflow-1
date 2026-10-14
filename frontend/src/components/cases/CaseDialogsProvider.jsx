import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useCase } from "@/hooks/use-cases";
import { notifyError } from "@/lib/notify";
import { CaseControlDialog } from "./CaseControlDialog";
import { AssignTechnicianDialog, AttentionDialog, OverdueReasonDialog } from "./SmallCaseDialogs";

const CaseDialogsContext = createContext(null);

/** Case dialogs are shared by many screens: open them from anywhere with useCaseDialogs(). */
export function CaseDialogsProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const close = useCallback(() => setDialog(null), []);
  const api = useMemo(() => ({
    openCase: (id) => setDialog({ type: "case", id }),
    openAttention: (id) => setDialog({ type: "attention", id }),
    openOverdueReason: (id) => setDialog({ type: "overdue", id }),
    openAssign: (id) => setDialog({ type: "assign", id }),
  }), []);
  // Removed cases (e.g. opened from the Inbox) are not in the active data and load on their own.
  const { caseItem: c, error } = useCase(dialog?.id);

  useEffect(() => {
    if (!error) return;
    notifyError(error.response?.status === 404 ? "This case is no longer available." : "Could not load the case");
    close();
  }, [error, close]);

  return (
    <CaseDialogsContext.Provider value={api}>
      {children}
      {c && dialog.type === "case" && <CaseControlDialog c={c} onClose={close} onAttention={() => api.openAttention(c.id)} onOverdueReason={() => api.openOverdueReason(c.id)} />}
      {c && dialog.type === "attention" && <AttentionDialog c={c} onClose={close} />}
      {c && dialog.type === "overdue" && <OverdueReasonDialog c={c} onClose={close} />}
      {c && dialog.type === "assign" && <AssignTechnicianDialog c={c} onClose={close} />}
    </CaseDialogsContext.Provider>
  );
}

export const useCaseDialogs = () => useContext(CaseDialogsContext);
