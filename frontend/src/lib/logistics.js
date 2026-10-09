import { addDays, today, weekdayOf } from "./format";

export const ACTIVE_ROUTE_STATUSES = ["published", "started", "break"];
export const isRouteCaseCode = (code) => /^[A-Za-z0-9._/-]{1,64}$/.test(String(code ?? "").trim());
export const routeStops = (route, stopsById) => (route?.stopIds || []).map((id) => stopsById[id]).filter(Boolean);

export const planStopIds = (plan) =>
  Object.entries(plan?.stopOrder || {}).sort((a, b) => Number(a[1]) - Number(b[1])).map(([id]) => id);

export function validDriverPlan(route, plan) {
  const assigned = route?.stopIds || [], planned = planStopIds(plan);
  return Boolean(plan?.confirmed && plan.routeId === route?.id && planned.length === assigned.length
    && new Set(planned).size === assigned.length && planned.every((id) => assigned.includes(id)));
}

export function driverPlanNeedsUpdate(route, plan) {
  const assigned = route?.stopIds || [], planned = planStopIds(plan);
  return Boolean(plan?.confirmed && plan.routeId === route?.id && planned.length < assigned.length && planned.every((id) => assigned.includes(id)));
}

/** Stop order the driver confirmed, with any newly added (unplaced) stops appended. */
export function routeOrderIds(route, plan) {
  if (!plan?.confirmed) return [...(route?.stopIds || [])];
  const planned = planStopIds(plan).filter((id) => route.stopIds.includes(id));
  return [...planned, ...route.stopIds.filter((id) => !planned.includes(id))];
}

export const orderedStops = (route, plan, stopsById) => routeOrderIds(route, plan).map((id) => stopsById[id]).filter(Boolean);

export function groupStopsByClinic(stops) {
  const groups = new Map();
  for (const stop of stops) {
    if (!groups.has(stop.clinicId)) groups.set(stop.clinicId, []);
    groups.get(stop.clinicId).push(stop);
  }
  return [...groups].map(([clinicId, clinicStops]) => ({
    clinicId,
    stops: clinicStops.sort((a, b) => Number(Boolean(b.deliveries?.length)) - Number(Boolean(a.deliveries?.length))),
  }));
}

export const readyKey = (c) => `${c.id}|${c.managerConfirmedAt}`;

function readyAssignment(c, stops, routesById) {
  for (const stop of stops) {
    const route = routesById[stop.routeId];
    if (!route || route.status === "cancelled" || !(route.stopIds || []).includes(stop.id)) continue;
    const caseRecordedAt = c.managerConfirmedAt || c.createdAt || c.receivedAt || "";
    const matches = (stop.deliveries || []).some((d) => (d.productionCaseId
      ? d.productionCaseId === c.id && String(d.productionConfirmedAt || "") === String(c.managerConfirmedAt || "")
      : String(d.caseNumber).trim() === String(c.code).trim() && String(stop.createdAt || route.createdAt || "") >= caseRecordedAt));
    if (matches) {
      return { status: stop.deliveryCompleted || stop.status === "completed" ? "delivered" : "assigned", routeId: route.id, clinicId: stop.clinicId };
    }
  }
  return null;
}

/** Active cases that have not already been added to a route. */
export function unroutedCases(cases, stops, routesById, statuses = ["queue", "production", "completed"]) {
  return cases
    .filter((c) => !c.deleted && !c.removedFromQueue && statuses.includes(c.status))
    .map((c) => ({ ...c, assignment: readyAssignment(c, stops, routesById) }))
    .filter((c) => !c.assignment)
    .sort((a, b) => String(a.createdAt || a.receivedAt || "").localeCompare(String(b.createdAt || b.receivedAt || "")));
}

export const inDraft = (c, deliveries) =>
  deliveries.some((d) => (d.productionCaseId === c.id && d.productionConfirmedAt === c.managerConfirmedAt) || String(d.caseNumber).trim() === String(c.code).trim());

export const readyAvailable = (c, deliveries) => !c.assignment && !inDraft(c, deliveries) && isRouteCaseCode(c.code);

export function defaultDriverDate() {
  const day = weekdayOf(today());
  return day === 6 ? addDays(today(), 2) : day === 0 ? addDays(today(), 1) : today();
}

export function workWeekDates(base) {
  const monday = addDays(base, -((weekdayOf(base) + 6) % 7));
  return [0, 1, 2, 3, 4].map((n) => addDays(monday, n));
}

export const stopJobs = (stop) => [
  ...(stop.deliveries || []).map((d) => `Delivery ${d.caseNumber}`),
  ...(stop.collections?.length ? ["Collection"] : []),
].join(" • ");

/** Count one stop per clinic and visit type, matching route publishing. */
export const draftStopCount = (collections, deliveries) =>
  new Set([
    ...deliveries.map((delivery) => `delivery:${delivery.clinicId}`),
    ...collections.map((collection) => `collection:${collection.clinicId}`),
  ]).size;

export const mapsUrl = (clinic) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([clinic?.address, clinic?.eircode].filter(Boolean).join(", "))}`;
