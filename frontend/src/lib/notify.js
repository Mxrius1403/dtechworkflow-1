import { toast } from "sonner";

export const notify = (message) => toast(message);
export const notifyError = (message) => toast.error(message);
