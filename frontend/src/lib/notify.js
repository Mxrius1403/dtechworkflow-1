import { toast } from "sonner";

export const notify = (message) => toast(message);
export const notifyError = (message) => toast.error(message);

/** Phase 1 is read-only: every save/submit/delete action ends here. Wire real API calls in Phase 2. */
export const demoSave = (message) =>
  toast.info(message, { description: "Demo mode — this change is not saved. Saving arrives in Phase 2." });
