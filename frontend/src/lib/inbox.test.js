import { inboxDestination, inboxTargetLabel, unreadMessages } from "./inbox";

const byId = {
  cases: { C1: { id: "C1" } },
  toothOrders: { TO1: { id: "TO1" } },
  materialOrders: { MO1: { id: "MO1" } },
  routes: { "R 1": { id: "R 1" } },
};

test.each([
  [{ target: "case", targetId: "C1" }, { caseId: "C1" }],
  [{ target: "toothOrder", targetId: "TO1" }, { path: "/tooth-orders#order-TO1" }],
  [{ target: "materialOrder", targetId: "MO1" }, { path: "/materials/requests#order-MO1" }],
  [{ target: "route", targetId: "R 1" }, { path: "/routes?open=R%201" }],
])("leads %o to its entry", (message, expected) => {
  expect(inboxDestination(message, byId)).toEqual(expected);
});

test("returns null when the entry was deleted or the target is unknown", () => {
  expect(inboxDestination({ target: "toothOrder", targetId: "TO9" }, byId)).toBeNull();
  expect(inboxDestination({ target: "unknown", targetId: "X" }, byId)).toBeNull();
});

test("labels and unread filter", () => {
  expect(inboxTargetLabel({ target: "materialOrder" })).toBe("material order");
  expect(inboxTargetLabel({ target: "other" })).toBe("item");
  expect(unreadMessages([{ id: 1, read: false }, { id: 2, read: true }])).toEqual([{ id: 1, read: false }]);
});
