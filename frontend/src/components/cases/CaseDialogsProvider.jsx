import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { CaseControlDialog } from "./CaseControlDialog";
import { AssignTechnicianDialog, AttentionDialog, OverdueReasonDialog } from "./SmallCaseDialogs";

const CaseDialogsContext = createContext(null);

/** Case dialogs are shared by many screens: open them from anywhere with useCaseDialogs(). */
export function CaseDialogsProvider({ children }) {
  const { byId } = useData();
  const [dialog, setDialog] = useState(null);
  const close = useCallback(() => setDialog(null), []);
  const api = useMemo(() => ({
    openCase: (id) => setDialog({ type: "case", id }),
    openAttention: (id) => setDialog({ type: "attention", id }),
    openOverdueReason: (id, afterComplete = false) => setDialog({ type: "overdue", id, afterComplete }),
    openAssign: (id) => setDialog({ type: "assign", id }),
  }), []);
  const c = dialog && byId.cases[dialog.id];

  return (
    <CaseDialogsContext.Provider value={api}>
      {children}
      {c && dialog.type === "case" && <CaseControlDialog c={c} onClose={close} onAttention={() => api.openAttention(c.id)} onOverdueReason={() => api.openOverdueReason(c.id)} />}
      {c && dialog.type === "attention" && <AttentionDialog c={c} onClose={close} />}
      {c && dialog.type === "overdue" && <OverdueReasonDialog c={c} afterComplete={dialog.afterComplete} onClose={close} />}
      {c && dialog.type === "assign" && <AssignTechnicianDialog c={c} onClose={close} />}
    </CaseDialogsContext.Provider>
  );
}

export const useCaseDialogs = () => useContext(CaseDialogsContext);
