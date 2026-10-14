import { matchServiceType, serviceTypeOptions, serviceTypesByDepartment } from "./serviceTypes";

test("service types are grouped by department in the order they were added", () => {
  const byDepartment = serviceTypesByDepartment([
    { id: "1", department: "ortho", name: "Aligner" },
    { id: "2", department: "prosthesis", name: "Repair" },
    { id: "3", department: "ortho", name: "Retainer" },
  ]);

  expect(byDepartment).toEqual({ prosthesis: ["Repair"], ortho: ["Aligner", "Retainer"], digital: [] });
});

test("None is always an option, even before anything is set up", () => {
  expect(serviceTypeOptions(serviceTypesByDepartment(undefined), "digital")).toEqual(["None"]);
  expect(serviceTypeOptions({ prosthesis: ["Repair"] }, "prosthesis")).toEqual(["Repair", "None"]);
});

test("names match regardless of case and extra spaces", () => {
  expect(matchServiceType(["Special Tray", "None"], "  special   TRAY ")).toBe("Special Tray");
  expect(matchServiceType(["Special Tray", "None"], "Tray")).toBeUndefined();
});
