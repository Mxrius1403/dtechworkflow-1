import { changedAreas } from "./liveUpdates";

const counters = { data: 4, cases: 10, inbox: 2, products: 0, serviceTypes: 1 };

test("the first reading reloads nothing", () => {
  expect(changedAreas(null, counters)).toEqual([]);
});

test("only areas whose counter moved are reloaded", () => {
  expect(changedAreas(counters, counters)).toEqual([]);
  expect(changedAreas(counters, { ...counters, cases: 11, inbox: 3 })).toEqual(["cases", "inbox"]);
});

test("a data change already brings the cases with it", () => {
  expect(changedAreas(counters, { ...counters, data: 5, cases: 11, products: 1 })).toEqual(["data", "products"]);
});

test("a reset counter still counts as a change", () => {
  expect(changedAreas(counters, { ...counters, inbox: 0 })).toEqual(["inbox"]);
});
