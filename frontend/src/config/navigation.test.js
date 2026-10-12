import { canOpen, isNavItemActive, navItemsFor, pageForPath } from "./navigation";

const caseSearchPage = pageForPath("/case-search");

test.each([
  ["technician", { isManager: false, isOwner: false }],
  ["manager", { isManager: true, isOwner: false }],
])("allows %s to open and see Case Search", (_role, user) => {
  expect(canOpen(caseSearchPage, user)).toBe(true);
  expect(navItemsFor(user).some(({ path }) => path === "/case-search")).toBe(true);
});

const managerPages = [
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
  "/delivery-management",
  "/tooth-management",
  "/technicians",
  "/reports",
];

test.each([
  ["manager", { isManager: true, isOwner: false }],
  ["owner", { isManager: false, isOwner: true }],
])("%s can open manager areas and see Create Route", (_role, user) => {
  for (const path of managerPages) {
    expect(canOpen(pageForPath(path), user)).toBe(true);
  }
  expect(canOpen(pageForPath("/delivery-management"), user)).toBe(true);
  expect(canOpen(pageForPath("/logistics"), user)).toBe(true);
  expect(navItemsFor(user).some(({ path, label }) => path === "/delivery-management" && label === "Delivery Management")).toBe(true);
  const navPaths = navItemsFor(user).map(({ path }) => path);
  expect(navPaths.indexOf("/delivery-management")).toBe(navPaths.indexOf("/case-search") + 1);
  expect(canOpen(pageForPath("/routes"), user)).toBe(true);
  for (const path of managerNavPages) {
    expect(navItemsFor(user).some(({ path: navPath }) => navPath === path)).toBe(true);
  }
  for (const path of ["/routes", "/logistics", "/drivers", "/clinics"]) {
    expect(navItemsFor(user).some(({ path: navPath }) => navPath === path)).toBe(false);
  }
  expect(navItemsFor(user).some(({ path }) => path === "/suppliers")).toBe(false);
  expect(navItemsFor(user).some(({ path, label }) => path === "/materials" && label === "Material Management")).toBe(true);

  expect(canOpen(pageForPath("/tooth-order"), user)).toBe(true);
  expect(navItemsFor(user).some(({ path }) => path === "/tooth-order")).toBe(false);
  expect(canOpen(pageForPath("/owner-control"), user)).toBe(user.isOwner);
  expect(navItemsFor(user).some(({ path }) => path === "/owner-control")).toBe(user.isOwner);
});

test("technicians cannot see Create Route or Routes", () => {
  const technician = { isManager: false, isOwner: false };
  expect(canOpen(pageForPath("/delivery-management"), technician)).toBe(false);
  expect(navItemsFor(technician).some(({ path }) => path === "/delivery-management")).toBe(false);
  expect(canOpen(pageForPath("/logistics"), technician)).toBe(false);
  expect(navItemsFor(technician).some(({ path }) => path === "/logistics")).toBe(false);
  expect(canOpen(pageForPath("/routes"), technician)).toBe(true);
  expect(navItemsFor(technician).some(({ path }) => path === "/routes")).toBe(false);
  expect(navItemsFor(technician).some(({ path }) => path === "/tooth-order")).toBe(true);
  expect(navItemsFor(technician).some(({ path }) => path === "/owner-control")).toBe(false);
});

test.each([
  ["/routes", "/delivery-management"],
  ["/logistics", "/delivery-management"],
  ["/drivers", "/delivery-management"],
  ["/clinics", "/delivery-management"],
  ["/tooth-order", "/tooth-management"],
  ["/tooth-orders", "/tooth-management"],
  ["/materials/requests", "/materials"],
  ["/materials/products", "/materials"],
  ["/materials/order", "/materials"],
  ["/suppliers", "/materials"],
])("%s keeps its management section active", (pathname, navPath) => {
  const user = { isManager: true, isOwner: false };
  const navItem = navItemsFor(user).find(({ path }) => path === navPath);

  expect(isNavItemActive(navItem, pathname)).toBe(true);
});

test("management sections do not match unrelated paths", () => {
  const user = { isManager: true, isOwner: false };
  const delivery = navItemsFor(user).find(({ path }) => path === "/delivery-management");
  const tooth = navItemsFor(user).find(({ path }) => path === "/tooth-management");

  expect(isNavItemActive(delivery, "/drivers-extra")).toBe(false);
  expect(isNavItemActive(tooth, "/tooth-orders-archive")).toBe(false);
});
