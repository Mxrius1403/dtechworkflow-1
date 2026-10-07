import { toast } from "sonner";

export const notify = (message) => toast(message);
export const notifyError = (message) => toast.error(message);

/** Placeholder for save/submit/delete actions that are not backed by API calls yet. */
export const demoSave = (message) =>
  toast.info(message, { description: "Demo mode — this change is not saved. Saving arrives in Phase 2." });
