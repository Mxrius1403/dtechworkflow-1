import { unroutedCases } from "./logistics";

const routesById = { R1: { id: "R1", status: "published", stopIds: ["S1"] } };
const stops = [{
  id: "S1",
  routeId: "R1",
  clinicId: "C1",
  deliveries: [{ productionCaseId: "routed", productionConfirmedAt: "" }],
}];

test("lists every active case not already assigned to a route", () => {
  const cases = [
    { id: "queued", code: "A-1001", status: "queue", createdAt: "2026-01-01" },
    { id: "working", code: "1002", status: "production", createdAt: "2026-01-02" },
    { id: "completed", code: "1003", status: "completed", completionReviewStatus: "pending", createdAt: "2026-01-03" },
    { id: "routed", code: "1004", status: "queue", createdAt: "2026-01-04" },
    { id: "removed", code: "1005", status: "removed", createdAt: "2026-01-05" },
    { id: "deleted", code: "1006", status: "queue", deleted: true, createdAt: "2026-01-06" },
  ];

  expect(unroutedCases(cases, stops, routesById).map((c) => c.id)).toEqual([
    "queued",
    "working",
    "completed",
  ]);
});

test("can limit unrouted cases to completed status", () => {
  const cases = [
    { id: "queued", code: "A-1001", status: "queue", createdAt: "2026-01-01" },
    { id: "working", code: "1002", status: "production", createdAt: "2026-01-02" },
    { id: "completed", code: "1003", status: "completed", createdAt: "2026-01-03" },
  ];

  expect(unroutedCases(cases, [], {}, ["completed"]).map((c) => c.id)).toEqual(["completed"]);
});
