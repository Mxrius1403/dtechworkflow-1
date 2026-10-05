import { today } from "./format";
import { workingDaysBetween, publicHolidayForDate, productionDayInfo } from "./holidays";

export const activeLeave = (requests) => requests.filter((r) => !r.deleted);
export const leaveCovers = (date, r) => r.status === "approved" && date >= r.from && date <= r.to;

/** Taken / future / pending working days for one technician in a calendar year. */
export function annualLeaveStats(requests, techId, year) {
  const yearStart = `${year}-01-01`, yearEnd = `${year}-12-31`, t = today();
  let taken = 0, future = 0, pending = 0;
  requests
    .filter((r) => r.technicianId === techId && r.from <= yearEnd && r.to >= yearStart)
    .forEach((r) => {
      const from = r.from < yearStart ? yearStart : r.from;
      const to = r.to > yearEnd ? yearEnd : r.to;
      const days = workingDaysBetween(from, to);
      if (r.status === "pending") pending += days;
      if (r.status !== "approved") return;
      if (to < t) taken += days;
      else if (from > t) future += days;
      else {
        const todayWorking = productionDayInfo(t).available && !publicHolidayForDate(t);
        taken += workingDaysBetween(from, t);
        future += Math.max(0, workingDaysBetween(t, to) - (todayWorking ? 1 : 0));
      }
    });
  return { taken, future, pending, totalApproved: taken + future };
}

export const overlapsExisting = (requests, techId, from, to) =>
  requests.some((r) => r.technicianId === techId && !["rejected", "cancelled"].includes(r.status) && from <= r.to && to >= r.from);
