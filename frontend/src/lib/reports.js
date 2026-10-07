import { addDays, calendarDaysBetween, dateKey, formatDuration, minutesBetween } from "./format";
import { DEPARTMENTS, caseDepartment, caseWasOverdue, departmentName, sessionValues } from "./cases";

const average = (values) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0);
const durations = (rows) => rows.map((x) => minutesBetween(x.startedAt, x.finishedAt)).filter((v) => v !== null);
const inRange = (iso, from, to) => {
  const key = dateKey(iso);
  return key >= from && key <= to;
};

export function makeFiveInsights(label, rows, previousRows, dayCount) {
  const total = rows.length, prev = previousRows.length;
  const times = durations(rows);
  const overdue = rows.filter((x) => x.overdue).length, onTime = total - overdue;
  const onTimeRate = total ? Math.round((onTime / total) * 100) : 0;
  const change = prev ? Math.round(((total - prev) / prev) * 1000) / 10 : total ? 100 : 0;
  const fastest = rows.filter((x) => minutesBetween(x.startedAt, x.finishedAt) !== null)
    .sort((a, b) => minutesBetween(a.startedAt, a.finishedAt) - minutesBetween(b.startedAt, b.finishedAt))[0];
  const perDay = total / Math.max(1, dayCount);
  return [
    { type: change >= 0 ? "good" : "warn", text: `${label}: ${total} completed case${total === 1 ? "" : "s"}, ${change >= 0 ? "up" : "down"} ${Math.abs(change)}% versus the previous equivalent period (${prev}).` },
    { type: overdue ? "warn" : "good", text: `${label}: ${overdue} overdue and ${onTime} on-time completion${onTime === 1 ? "" : "s"} (${onTimeRate}% on time).` },
    { type: "", text: `${label}: average production time was ${formatDuration(average(times))} across ${times.length} timed case${times.length === 1 ? "" : "s"}.` },
    fastest
      ? { type: "good", text: `${label}: fastest completed case was ${fastest.code} in ${formatDuration(minutesBetween(fastest.startedAt, fastest.finishedAt))}.` }
      : { type: "", text: `${label}: no completed timed case was available for a fastest-case comparison.` },
    total
      ? { type: "good", text: `${label}: production averaged ${perDay.toFixed(1)} completed case${perDay === 1 ? "" : "s"} per day in the selected period.` }
      : { type: "warn", text: `${label}: no completed production was recorded in the selected period.` },
  ];
}

/** Only manager-confirmed work sessions count. */
export function buildReport({ cases, users }, from, to) {
  const dayCount = Math.max(1, calendarDaysBetween(from, to) + 1);
  const prevTo = addDays(from, -1), prevFrom = addDays(from, -dayCount);
  const technicians = users.filter((user) => user.role === "technician" && user.loginEnabled === true);
  const technicianIds = new Set(technicians.map((user) => user.id));
  const current = [], previous = [];
  cases.filter((c) => !c.deleted).forEach((c) => sessionValues(c).forEach((s, index) => {
    if (!s.finishedAt || (s.completionReviewRequired === true && s.managerConfirmed !== true)) return;
    const technicianId = s.technicianId || c.finishedById || c.technicianId;
    if (!technicianIds.has(technicianId)) return;
    const row = {
      ...s, sessionIndex: index + 1, code: c.code, caseId: c.id, department: caseDepartment(c),
      overdue: Boolean(s.overdue || caseWasOverdue(c)), technicianId,
      technician: s.technician || c.finishedBy || c.technician, serviceTypes: s.serviceTypes || c.serviceTypes || [],
      arch: s.arch || c.arch || "", overdueReason: s.overdueReason || c.overdueReason || "",
    };
    if (inRange(s.finishedAt, from, to)) current.push(row);
    else if (inRange(s.finishedAt, prevFrom, prevTo)) previous.push(row);
  }));

  const byTech = technicians.map((u) => {
    const rows = current.filter((x) => x.technicianId === u.id);
    return {
      id: u.id, name: u.name,
      cases: rows.sort((x, y) => String(x.startedAt).localeCompare(String(y.startedAt))),
      total: rows.length, overdue: rows.filter((c) => c.overdue).length, avgMinutes: average(durations(rows)),
      insights: makeFiveInsights(`${u.name} (${u.id})`, rows, previous.filter((x) => x.technicianId === u.id), dayCount),
    };
  });

  const departmentInsights = Object.fromEntries(DEPARTMENTS.map((dep) => [
    dep, makeFiveInsights(departmentName(dep), current.filter((x) => x.department === dep), previous.filter((x) => x.department === dep), dayCount),
  ]));
  return {
    from, to, cases: current, completed: current, overdue: current.filter((x) => x.overdue),
    avgAll: average(durations(current)), byTech, departmentInsights, createdAt: new Date().toISOString(),
  };
}
