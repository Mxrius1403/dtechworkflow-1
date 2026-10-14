import { attentionGroups, caseWasOverdue, isOverdue, overdueSummary, receivingOutcome, scanOutcome } from "./cases";

test("case was overdue when flagged now, before, or by a legacy history entry", () => {
  expect(caseWasOverdue({ overdue: true })).toBe(true);
  expect(caseWasOverdue({ wasOverdue: true })).toBe(true);
  expect(caseWasOverdue({ markedOverdue: true })).toBe(true);
  expect(caseWasOverdue({})).toBe(false);
});

test("automatically removed cases are directed to Case Search", () => {
  const result = receivingOutcome(
    [{
      id: "case-1",
      code: "CASE-1",
      status: "removed",
      autoRemovedFromQueue: true,
    }],
    "CASE-1",
  );

  expect(result).toEqual({
    kind: "error",
    message: "Case CASE-1 was removed after 10 days. Find it in Case Search.",
  });
});

test.each(["prosthesis", "ortho", "digital"])(
  "technicians can start cases categorized as %s",
  (department) => {
    const result = scanOutcome(
      [{ id: "case-1", code: "CASE-1", department, status: "queue" }],
      "CASE-1",
      { id: "DT001" },
      () => "",
    );

    expect(result).toEqual({ kind: "save", message: "Case CASE-1 started" });
  },
);

describe("date based overdue", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-13T10:00:00Z"));
  });
  afterEach(() => jest.useRealTimers());

  test("open cases past their due date are overdue", () => {
    expect(isOverdue({ status: "queue", currentDueDate: "2026-10-12" })).toBe(true);
    expect(isOverdue({ status: "production", currentDueDate: "2026-10-01" })).toBe(true);
    expect(isOverdue({ status: "queue", currentDueDate: "2026-10-13" })).toBe(false);
    expect(isOverdue({ status: "queue", currentDueDate: "2026-10-14" })).toBe(false);
  });

  test("manually flagged open cases stay overdue", () => {
    expect(isOverdue({ status: "queue", currentDueDate: "2026-10-20", overdue: true })).toBe(true);
  });

  test("completed, removed and deleted cases are never overdue", () => {
    expect(isOverdue({ status: "completed", currentDueDate: "2026-10-01" })).toBe(false);
    expect(isOverdue({ status: "removed", currentDueDate: "2026-10-01" })).toBe(false);
    expect(isOverdue({ status: "queue", currentDueDate: "2026-10-01", deleted: true })).toBe(false);
  });

  test("dashboard overdue list includes past due open cases", () => {
    const g = attentionGroups([
      { id: "a", status: "queue", currentDueDate: "2026-10-10" },
      { id: "b", status: "queue", currentDueDate: "2026-10-13" },
      { id: "c", status: "completed", currentDueDate: "2026-10-10" },
      { id: "d", status: "production", currentDueDate: "2026-10-20", overdue: true },
    ]);
    expect(g.overdue.map((c) => c.id)).toEqual(["a", "d"]);
  });

  test("overdue days for an open past due case count up to today", () => {
    expect(overdueSummary({ status: "queue", originalScheduledDate: "2026-10-10", currentDueDate: "2026-10-10" }))
      .toMatchObject({ original: "2026-10-10", comparison: "2026-10-13", pastDue: true, days: 3 });
  });
});
