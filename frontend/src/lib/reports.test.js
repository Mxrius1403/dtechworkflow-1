import { buildReport } from "./reports";

const period = { from: "2026-10-05", to: "2026-10-11" };

test("builds a report from confirmed production in the selected period", () => {
  const report = buildReport({
    users: [
      { id: "DT001", name: "Aisling Byrne", role: "technician", loginEnabled: true },
      { id: "TEST-TECH-002", name: "Technician Without Login", role: "technician", loginEnabled: false },
      { id: "DT003", name: "Technician Without Cases", role: "technician", loginEnabled: true },
    ],
    cases: [
      {
        id: "case-1",
        code: "4101",
        department: "prosthesis",
        workSessions: [{
          startedAt: "2026-10-06T09:00:00Z",
          finishedAt: "2026-10-06T09:45:00Z",
          technicianId: "DT001",
          completionReviewRequired: true,
          managerConfirmed: true,
        }],
      },
      {
        id: "case-unassigned",
        code: "4104",
        department: "prosthesis",
        workSessions: [{
          startedAt: "2026-10-06T09:00:00Z",
          finishedAt: "2026-10-06T09:45:00Z",
          technicianId: "TEST-TECH-002",
          completionReviewRequired: true,
          managerConfirmed: true,
        }],
      },
      {
        id: "case-pending",
        code: "4102",
        department: "prosthesis",
        workSessions: [{
          startedAt: "2026-10-07T09:00:00Z",
          finishedAt: "2026-10-07T09:45:00Z",
          technicianId: "DT001",
          completionReviewRequired: true,
          managerConfirmed: false,
        }],
      },
      {
        id: "case-outside",
        code: "4103",
        department: "prosthesis",
        workSessions: [{
          startedAt: "2026-10-12T09:00:00Z",
          finishedAt: "2026-10-12T09:45:00Z",
          technicianId: "DT001",
          completionReviewRequired: true,
          managerConfirmed: true,
        }],
      },
    ],
  }, period.from, period.to);

  expect(report.cases.map((row) => row.code)).toEqual(["4101"]);
  expect(report.completed).toHaveLength(1);
  expect(report.byTech).toHaveLength(2);
  expect(report.byTech[0].total).toBe(1);
  expect(report.byTech[0].cases.map((row) => row.code)).toEqual(["4101"]);
  expect(report.byTech[1]).toMatchObject({
    id: "DT003",
    total: 0,
    overdue: 0,
    cases: [],
  });
});
