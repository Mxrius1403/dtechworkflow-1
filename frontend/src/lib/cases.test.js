import { scanOutcome } from "./cases";

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
