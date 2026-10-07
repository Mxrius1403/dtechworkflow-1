import { caseSearchRows, scanOutcome } from "./cases";

test("case search includes every status and soft-deleted cases", () => {
  const cases = [
    { id: "1", code: "CASE-1", status: "queue" },
    { id: "2", code: "CASE-2", status: "production" },
    { id: "3", code: "CASE-3", status: "completed" },
    { id: "4", code: "CASE-4", status: "removed" },
    { id: "5", code: "CASE-5", status: "queue", deleted: true },
  ];

  expect(caseSearchRows(cases).map((c) => c.id)).toEqual(["1", "2", "3", "4", "5"]);
});

test("case search matches the case number without regard to letter case", () => {
  const cases = [
    { id: "1", code: "CASE-4101", status: "queue" },
    { id: "2", code: "CASE-4102", status: "completed" },
  ];

  expect(caseSearchRows(cases, "case-4102").map((c) => c.id)).toEqual(["2"]);
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
