import { calendarDaysBetween, dateKey, isToday, nice, timeOf, today } from "./format";

export const DEPARTMENTS = ["prosthesis", "ortho", "digital"];
export const departmentKey = (department) =>
  department === "denture" ? "prosthesis" : department || "prosthesis";
export const departmentName = (department) => {
  const key = departmentKey(department);
  return key === "ortho" ? "Ortho" : key === "digital" ? "Digital" : "Prosthesis";
};
export const caseDepartment = (c) => departmentKey(c.department);

export const scheduledKey = (c) => c.currentDueDate || c.scheduledDate || c.receivedDate || "";
export const dueSortKey = (c) => `${scheduledKey(c)} ${c.currentDueTime || "99:99"}`;
export const dueLabel = (c) => {
  const key = scheduledKey(c);
  if (!key) return "";
  return c.currentDueTime ? `${nice(key)}, ${c.currentDueTime}` : nice(key);
};

export function originalScheduledKey(c) {
  const missed = Object.keys(c.missedScheduleDates || {}).sort();
  return c.originalScheduledDate || missed[0] || c.scheduledDate || c.receivedDate || scheduledKey(c);
}

export function overdueSummary(c) {
  const original = originalScheduledKey(c);
  const completed = c.finishedDate || (c.finishedAt ? dateKey(c.finishedAt) : "");
  const due = scheduledKey(c);
  const t = today();
  // An open case past its due date keeps counting overdue days until today.
  const pastDue = !completed && (!due || due < t);
  const comparison = completed || (pastDue ? t : due);
  return { original, comparison, completed: Boolean(completed), pastDue, days: calendarDaysBetween(original, comparison) };
}

export const serviceLabel = (c) => `${(c.serviceTypes || []).join(" + ") || "Not specified"} • ${c.arch || "Arch not specified"}`;

export const DELIVERY_STATUSES = [
  ["not_delivered", "Not Delivered"],
  ["out_for_delivery", "Out for Delivery"],
  ["delivered", "Delivered"],
];
export const deliveryStatusLabel = (c) =>
  (DELIVERY_STATUSES.find(([value]) => value === (c?.deliveryStatus || "not_delivered")) || DELIVERY_STATUSES[0])[1];

export const attentionLabel = (c) =>
  c.attentionStatus === "on_hold" ? "On Hold" : c.attentionStatus === "need_information" ? "Need Information" : "";

/** markedOverdue: set by the server when the case history has a legacy "marked overdue" entry. */
export const caseWasOverdue = (c) => Boolean(c?.overdue || c?.wasOverdue || c?.markedOverdue);

export const liveCases = (cases) => cases.filter((c) => !c.deleted);
const isOpen = (c) => !c.deleted && c.status !== "completed" && c.status !== "removed";

/** Open case that a Manager marked overdue, or whose due date is before today. */
export const isOverdue = (c) => {
  if (!isOpen(c)) return false;
  const due = scheduledKey(c);
  return Boolean(c.overdue) || (Boolean(due) && due < today());
};

export function todayCases(cases) {
  const t = today();
  return cases.filter((c) => {
    if (c.deleted || c.status === "removed") return false;
    if (c.status === "completed") return isToday(c.finishedAt) || c.finishedDate === t || scheduledKey(c) === t;
    return scheduledKey(c) === t || Boolean(c.overdue);
  });
}

export function attentionGroups(cases) {
  const open = cases.filter(isOpen);
  const t = today();
  return {
    due: open.filter((c) => scheduledKey(c) === t),
    holds: open.filter((c) => c.attentionStatus === "on_hold"),
    info: open.filter((c) => c.attentionStatus === "need_information"),
    overdue: open.filter(isOverdue),
  };
}

export const completionReviewCases = (cases) =>
  cases
    .filter((c) => !c.deleted && c.status === "completed" && c.completionReviewRequired === true && c.completionReviewStatus === "pending")
    .sort((a, b) => String(a.completionRequestedAt || a.finishedAt || "").localeCompare(String(b.completionRequestedAt || b.finishedAt || "")));

export function sessionValues(c) {
  const rows = (c?.workSessions || []).filter(Boolean);
  if (rows.length) return [...rows].sort((a, b) => String(a.startedAt || "").localeCompare(String(b.startedAt || "")));
  if (!c?.startedAt) return [];
  return [{
    id: "legacy", startedAt: c.startedAt, startedTime: c.startedTime || timeOf(c.startedAt), finishedAt: c.finishedAt || "",
    finishedTime: c.finishedTime || (c.finishedAt ? timeOf(c.finishedAt) : ""), technicianId: c.finishedById || c.technicianId || "",
    technician: c.finishedBy || c.technician || "", overdue: caseWasOverdue(c), legacy: true,
  }];
}

/** Finished work archived each time a completed case was re-entered, oldest first.
 *  Each cycle carries its own technician, department and overdue state. */
export function reentrySessions(c) {
  return (c?.reentryCycles || []).filter((cycle) => cycle?.finishedAt).map((cycle, index) => ({
    id: `reentry-${index + 1}`, startedAt: cycle.startedAt || "", startedTime: cycle.startedTime || (cycle.startedAt ? timeOf(cycle.startedAt) : ""),
    finishedAt: cycle.finishedAt, finishedDate: cycle.finishedDate || "", finishedTime: cycle.finishedTime || timeOf(cycle.finishedAt),
    technicianId: cycle.finishedById || cycle.technicianId || "", technician: cycle.finishedBy || cycle.technician || "",
    department: departmentKey(cycle.department || c.department), overdue: Boolean(cycle.overdue || cycle.wasOverdue),
    overdueReason: cycle.overdueReason || "", serviceTypes: cycle.serviceTypes || [], arch: cycle.arch || "",
    completionReviewRequired: cycle.completionReviewRequired === true, managerConfirmed: Boolean(cycle.managerConfirmedAt), reentry: true,
  }));
}

export function sessionHistoryRows(c) {
  return sessionValues(c)
    .filter((s) => s.startedAt || s.finishedAt)
    .map((s, index) => ({
      key: `${c.id}-${s.id || index}`, caseId: c.id, code: c.code, department: caseDepartment(c),
      date: s.startedDate || s.finishedDate || dateKey(s.startedAt || s.finishedAt),
      startedAt: s.startedAt || "", startedTime: s.startedTime || (s.startedAt ? timeOf(s.startedAt) : ""),
      finishedAt: s.finishedAt || "", finishedTime: s.finishedTime || (s.finishedAt ? timeOf(s.finishedAt) : ""),
      technicianId: s.technicianId || c.finishedById || c.technicianId, technician: s.technician || c.finishedBy || c.technician,
    }))
    .sort((a, b) => String(b.startedAt || b.finishedAt).localeCompare(String(a.startedAt || a.finishedAt)));
}

export const normaliseCaseCode = (value) =>
  String(value ?? "").replace(/[\r\n\t ]+/g, "").replace(/[^A-Za-z0-9._/-]/g, "").slice(0, 64);

const sortStamp = (c) => String(c.updatedAt || c.startedAt || c.receivedAt || c.finishedAt || c.createdAt || "");
const latestFirst = (rows) => [...rows].sort((a, b) => sortStamp(b).localeCompare(sortStamp(a)));
const matchingCode = (cases, code) => cases.filter((c) => !c.deleted && normaliseCaseCode(c.code) === code);

export function chooseScanCase(cases, techId) {
  const rows = latestFirst(cases);
  return rows.find((c) => c.status === "production" && c.technicianId === techId)
    || rows.find((c) => c.status === "queue")
    || rows.find((c) => c.status === "production")
    || rows.find((c) => c.status === "completed")
    || null;
}

/** What scanning a barcode would do for this user (mirrors the original scan transaction rules). */
export function scanOutcome(cases, value, user, techName) {
  const code = normaliseCaseCode(value);
  if (!code) return null;
  const selected = chooseScanCase(matchingCode(cases, code), user.id);
  if (!selected) return { kind: "error", message: user.isManager ? "Case not found. Add it in Receiving." : "Case not found. Ask Receiving." };
  if (user.isManager) return { kind: "manage", caseItem: selected };
  if (selected.overdueReasonRequired && selected.technicianId === user.id && !selected.overdueReason) return { kind: "overdueReason", caseItem: selected };
  if (selected.status === "queue") return { kind: "save", message: `Case ${code} started` };
  if (selected.status === "production" && selected.technicianId !== user.id) {
    return { kind: "error", message: `Already in production by ${techName(selected.technicianId, selected.technician) || "another technician"}` };
  }
  if (selected.status === "production") return { kind: "save", message: `Case ${code} submitted for Manager confirmation` };
  return { kind: "error", message: `Case ${code} is already completed. Re-enter it through Receiving.` };
}

/** What receiving a scanned code would do: new case, re-entry, duplicate warning or restore. */
export function receivingOutcome(cases, value) {
  const code = normaliseCaseCode(value);
  if (!code) return { kind: "error", message: "Scan a valid case number" };
  const rows = matchingCode(cases, code);
  if (rows.some((c) => c.completionReviewStatus === "pending")) return { kind: "error", message: "This completion is awaiting Manager confirmation" };
  const existing = latestFirst(rows)[0];
  if (!existing) return { kind: "new", code };
  if (existing.status === "removed") {
    if (existing.autoRemovedFromQueue) {
      return { kind: "error", message: `Case ${code} was removed after 10 days. Find it in Case Search.` };
    }
    // Finished work comes back as a re-entry, so its service types are chosen again.
    if (existing.previousQueueStatus === "completed") return { kind: "reentry", code, caseItem: existing };
    return { kind: "removed", code, caseItem: existing };
  }
  if (existing.status !== "completed") return { kind: "duplicate", code, caseItem: existing };
  return { kind: "reentry", code, caseItem: existing };
}

export function casePlace(c, techName) {
  const dept = departmentName(caseDepartment(c));
  if (c.status === "queue") return `${dept} Queue`;
  if (c.status === "production") return `${dept} Production with ${techName(c.technicianId, c.technician) || "a technician"}`;
  return `${dept} Completed`;
}

export function caseWho(c, techName) {
  if (c.status === "queue") {
    const received = `Received ${c.receivedDate || ""} ${c.receivedTime || ""}`.trim();
    if (!c.technicianId) return received;
    return `${techName(c.technicianId, c.technician) || c.technicianId} (${c.technicianId}) • ${received}`;
  }
  if (c.status === "production") return `${techName(c.technicianId, c.technician)} (${c.technicianId}) • started ${c.startedTime || timeOf(c.startedAt)}`;
  if (c.status === "completed") return `${techName(c.finishedById, c.finishedBy)} (${c.finishedById}) • finished ${c.finishedTime || timeOf(c.finishedAt)}`;
  return "Removed from queue";
}
