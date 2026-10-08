import { canOpen, navItemsFor, pageForPath } from "./navigation";

const caseSearchPage = pageForPath("/case-search");

test.each([
  ["technician", { isManager: false, isOwner: false }],
  ["manager", { isManager: true, isOwner: false }],
])("allows %s to open and see Case Search", (_role, user) => {
  expect(canOpen(caseSearchPage, user)).toBe(true);
  expect(navItemsFor(user).some(({ path }) => path === "/case-search")).toBe(true);
});

const managerPages = [
  "/logistics",
  "/drivers",
  "/clinics",
  "/suppliers",
  "/tooth-management",
  "/tooth-orders",
  "/materials/requests",
  "/materials/products",
  "/materials/order",
  "/technicians",
  "/reports",
];

const managerNavPages = [
  "/drivers",
  "/clinics",
  "/tooth-management",
  "/technicians",
  "/reports",
];

test.each([
  ["manager", { isManager: true, isOwner: false }],
  ["owner", { isManager: false, isOwner: true }],
])("%s can open manager areas while logistics stays hidden from navigation", (_role, user) => {
  for (const path of managerPages) {
    expect(canOpen(pageForPath(path), user)).toBe(true);
  }
  expect(navItemsFor(user).some(({ path }) => path === "/logistics")).toBe(false);
  for (const path of managerNavPages) {
    expect(navItemsFor(user).some(({ path: navPath }) => navPath === path)).toBe(true);
  }
  expect(navItemsFor(user).some(({ path }) => path === "/suppliers")).toBe(false);
  expect(navItemsFor(user).some(({ path, label }) => path === "/materials" && label === "Material Management")).toBe(true);

  expect(canOpen(pageForPath("/tooth-order"), user)).toBe(true);
  expect(navItemsFor(user).some(({ path }) => path === "/tooth-order")).toBe(false);
  expect(canOpen(pageForPath("/owner-control"), user)).toBe(user.isOwner);
  expect(navItemsFor(user).some(({ path }) => path === "/owner-control")).toBe(user.isOwner);
});

test("technician navigation and manager-only access remain unchanged", () => {
  const technician = { isManager: false, isOwner: false };
  expect(canOpen(pageForPath("/logistics"), technician)).toBe(false);
  expect(navItemsFor(technician).some(({ path }) => path === "/logistics")).toBe(false);
  expect(navItemsFor(technician).some(({ path }) => path === "/tooth-order")).toBe(true);
  expect(navItemsFor(technician).some(({ path }) => path === "/owner-control")).toBe(false);
});
