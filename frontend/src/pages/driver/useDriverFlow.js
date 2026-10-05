import { useState } from "react";
import { driverPlanNeedsUpdate, planStopIds, routeOrderIds, validDriverPlan } from "@/lib/logistics";
import { demoSave, notifyError } from "@/lib/notify";

const coversRoute = (planned, assigned) =>
  planned.length === assigned.length && new Set(planned).size === assigned.length && planned.every((id) => assigned.includes(id));

/**
 * Driver mission state machine (same stages as the original driver app):
 * home -> checklist -> planning -> preview -> (route started) active <-> replanning (urgent stops).
 * Stage changes are local; anything the original saved to the database ends in demoSave().
 */
export function useDriverFlow(route, plan, stopsById) {
  const [stage, setStage] = useState("home");
  const [view, setView] = useState("current");
  const [order, setOrder] = useState([]);
  const [locked, setLocked] = useState(0);
  const [checked, setChecked] = useState(() => new Set());
  const [confirmedLocally, setConfirmedLocally] = useState(false);

  const move = (index, target) => {
    if (index < locked || index >= order.length) return;
    const next = [...order];
    const [item] = next.splice(index, 1);
    const destination = target === "first" ? locked : target === "last" ? next.length : Math.max(locked, Math.min(next.length, index + target));
    next.splice(destination, 0, item);
    setOrder(next);
  };

  return {
    stage, setStage, view, setView, order, locked, checked, move,
    beginDay() {
      setStage("checklist");
      setOrder([]);
      setLocked(0);
      setChecked(new Set());
    },
    toggleLoaded(caseNumber, on) {
      setChecked((prev) => {
        const next = new Set(prev);
        if (on) next.add(caseNumber);
        else next.delete(caseNumber);
        return next;
      });
    },
    startPlanning() {
      setLocked(0);
      const confirmed = validDriverPlan(route, plan);
      setOrder(confirmed ? planStopIds(plan) : [...route.stopIds]);
      setStage(confirmed ? "preview" : "planning");
    },
    confirmRoute() {
      if (route.status !== "published") return notifyError("This route can no longer be planned");
      if (!coversRoute(order, route.stopIds)) return notifyError("The route plan is incomplete. Reload and try again.");
      setConfirmedLocally(true);
      setStage("preview");
      demoSave("Your route order has been confirmed");
    },
    startMission() {
      if (!validDriverPlan(route, plan) && !confirmedLocally) return notifyError("Confirm your clinic order before starting the route");
      demoSave("Mission started • clinic tracking updated");
    },
    startUpdatePlanning() {
      if (!driverPlanNeedsUpdate(route, plan)) return notifyError("There is no route update awaiting placement");
      const ids = routeOrderIds(route, plan);
      const firstPending = Math.max(0, ids.findIndex((id) => stopsById[id]?.status !== "completed"));
      setOrder(ids);
      setLocked(Math.min(ids.length, firstPending + 1));
      setStage("replanning");
    },
    confirmUpdate() {
      if (!coversRoute(order, route.stopIds)) return notifyError("The updated route is incomplete");
      const before = routeOrderIds(route, plan).slice(0, locked);
      if (before.some((id, i) => order[i] !== id)) return notifyError("Current and completed stops cannot be moved");
      setStage("active");
      setLocked(0);
      demoSave("Updated route confirmed • existing links refreshed");
    },
  };
}
