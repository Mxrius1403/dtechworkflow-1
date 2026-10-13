import { caseWasOverdue, receivingOutcome, scanOutcome } from "./cases";

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
