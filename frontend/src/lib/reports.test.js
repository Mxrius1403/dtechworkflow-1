import { buildReport, reportWindow } from "./reports";

const period = { from: "2026-10-05", to: "2026-10-11" };

test("builds a report from confirmed production in the selected period", () => {
  const report = buildReport({
    users: [
      { id: "DT001", name: "Aisling Byrne", role: "technician", loginEnabled: true },
      { id: "TEST-TECH-002", name: "Technician Without Login", role: "technician", loginEnabled: false },
      { id: "DT003", name: "Technician Without Cases", role: "technician", loginEnabled: true },
      { id: "DT004", name: "Deleted Technician", role: "technician", loginEnabled: true, deleted: true },
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
        id: "case-deleted-technician",
        code: "4105",
        department: "prosthesis",
        workSessions: [{
          startedAt: "2026-10-08T09:00:00Z",
          finishedAt: "2026-10-08T09:45:00Z",
          technicianId: "DT004",
          completionReviewRequired: true,
          managerConfirmed: true,
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
  expect(report.byTech.some((technician) => technician.id === "DT004")).toBe(false);
  expect(report.byTech[0].total).toBe(1);
  expect(report.byTech[0].cases.map((row) => row.code)).toEqual(["4101"]);
  expect(report.byTech[1]).toMatchObject({
    id: "DT003",
    total: 0,
    overdue: 0,
    cases: [],
  });
});

test("counts a re-entered case once per finished cycle", () => {
  const cycle = (day, technicianId, extra = {}) => ({
    status: "completed", technicianId, finishedById: technicianId, startedAt: `2026-10-${day}T09:00:00Z`,
    finishedAt: `2026-10-${day}T10:00:00Z`, serviceTypes: ["Try In"], arch: "Upper", archivedAt: `2026-10-${day}T11:00:00Z`, ...extra,
  });
  const report = buildReport({
    users: [
      { id: "DT001", name: "Aisling Byrne", role: "technician", loginEnabled: true },
      { id: "DT002", name: "Ciaran Walsh", role: "technician", loginEnabled: true },
    ],
    cases: [{
      id: "case-reentered",
      code: "4201",
      department: "digital",
      status: "completed",
      reentryCycles: [
        cycle("05", "DT001", { department: "prosthesis", overdue: true }),
        cycle("07", "DT002"),
        // Archived before cycles kept their technician: not attributed to anyone.
        { status: "completed", finishedAt: "2026-10-08T10:00:00Z", serviceTypes: ["Try In"], arch: "Upper" },
      ],
      technicianId: "DT001",
      finishedById: "DT001",
      startedAt: "2026-10-09T09:00:00Z",
      finishedAt: "2026-10-09T09:30:00Z",
    }],
  }, period.from, period.to);

  expect(report.cases.map((row) => [row.finishedAt.slice(0, 10), row.technicianId, row.department, row.overdue])).toEqual([
    ["2026-10-05", "DT001", "prosthesis", true],
    ["2026-10-07", "DT002", "digital", false],
    ["2026-10-09", "DT001", "digital", false],
  ]);
  expect(new Set(report.cases.map((row) => row.sessionIndex)).size).toBe(3);
  expect(report.byTech.map((technician) => [technician.id, technician.total])).toEqual([["DT001", 2], ["DT002", 1]]);
  expect(report.departmentInsights.prosthesis[0].text).toContain("1 completed case");
});

test("the report window adds the previous period of the same length", () => {
  expect(reportWindow("2026-10-05", "2026-10-11")).toEqual({ dayCount: 7, prevFrom: "2026-09-28", prevTo: "2026-10-04" });
  expect(reportWindow("2026-10-05", "2026-10-05")).toEqual({ dayCount: 1, prevFrom: "2026-10-04", prevTo: "2026-10-04" });
});
