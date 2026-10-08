import { canOpen, navItemsFor, pageForPath } from "./navigation";

const caseSearchPage = pageForPath("/case-search");

test.each([
  ["technician", { isManager: false, isOwner: false }],
  ["manager", { isManager: true, isOwner: false }],
  ["owner", { isManager: false, isOwner: true }],
])("allows %s to open and see Case Search", (_role, user) => {
  expect(canOpen(caseSearchPage, user)).toBe(true);
  expect(navItemsFor(user).some(({ path }) => path === "/case-search")).toBe(true);
});
