import { normaliseCaseImport, validateCaseImport } from "./csv";

const validCase = {
  code: "CASE-1",
  department: "prosthesis",
  currentDueDate: "2026-10-20",
};

test("case import accepts None for service type and arch", () => {
  const rows = normaliseCaseImport([
    { ...validCase, serviceTypes: ["None"], arch: "None" },
  ]);

  expect(validateCaseImport(rows)).toEqual([]);
});

test("case import rejects None combined with another service", () => {
  const rows = normaliseCaseImport([
    { ...validCase, serviceTypes: ["None", "Repair"], arch: "Upper" },
  ]);

  expect(validateCaseImport(rows)).toContain("Row 2: invalid service types");
});
