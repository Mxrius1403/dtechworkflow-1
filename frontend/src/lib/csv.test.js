import { casesFromJson, normaliseCaseImport, validateCaseImport } from "./csv";

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

test("case import only accepts service types set up for the case's department", () => {
  const setUp = { prosthesis: ["Repair", "Try In"], ortho: ["Aligner"], digital: [] };
  const rows = normaliseCaseImport([
    { ...validCase, serviceTypes: "repair; TRY IN", arch: "Upper" },
    { ...validCase, code: "CASE-2", department: "ortho", serviceTypes: "Repair;Bite", arch: "Upper" },
    { ...validCase, code: "CASE-3", department: "digital", serviceTypes: "none", arch: "None" },
  ], setUp);

  expect(rows[0].serviceTypes).toEqual(["Repair", "Try In"]);
  expect(rows[2].serviceTypes).toEqual(["None"]);
  expect(validateCaseImport(rows, setUp)).toEqual(["Row 3: Repair, Bite are not service types for Ortho"]);
});

test("case import rejects the same service type twice", () => {
  const setUp = { prosthesis: ["Repair"] };
  const rows = normaliseCaseImport([{ ...validCase, serviceTypes: ["Repair", "repair"], arch: "Upper" }], setUp);

  expect(validateCaseImport(rows, setUp)).toEqual(["Row 2: invalid service types"]);
});

test("case import supports Firebase exports and skips deleted cases", () => {
  const exported = {
    "6251": {
      code: "6251",
      department: "denture",
      receivedDate: "2026-07-09",
      status: "queue",
      receivedAt: "2026-07-09T04:05:48.820Z",
      history: { legacy_0: { action: "Created in Queue", at: "2026-07-09T04:05:48.820Z", by: "Register" } },
    },
    "6353": {
      code: "6353",
      department: "denture",
      deleted: true,
      receivedDate: "not-a-date",
      status: "production",
    },
  };

  const rows = normaliseCaseImport(casesFromJson(exported));

  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    code: "6251",
    department: "prosthesis",
    currentDueDate: "2026-07-09",
    serviceTypes: ["None"],
    arch: "None",
    status: "queue",
  });
  expect(validateCaseImport(rows)).toEqual([]);
});

test("case import allows Firebase exports larger than 500 cases", () => {
  const rows = normaliseCaseImport(Array.from({ length: 501 }, (_, i) => ({
    ...validCase,
    code: `CASE-${i}`,
    serviceTypes: ["None"],
    arch: "None",
  })));

  expect(validateCaseImport(rows)).toEqual([]);
});
