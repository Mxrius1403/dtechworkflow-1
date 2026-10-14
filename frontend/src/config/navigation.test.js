import { canOpen, isNavItemActive, navItemsFor, pageForPath } from "./navigation";

test("technicians open Receiving and Case Search from the sidebar", () => {
  const technician = { isManager: false, isOwner: false };
  for (const path of ["/receiving", "/case-search"]) {
    expect(canOpen(pageForPath(path), technician)).toBe(true);
    expect(navItemsFor(technician).some(({ path: navPath }) => navPath === path)).toBe(true);
  }
  expect(canOpen(pageForPath("/case-management"), technician)).toBe(false);
  expect(navItemsFor(technician).some(({ path }) => path === "/case-management")).toBe(false);
  expect(canOpen(pageForPath("/service-types"), technician)).toBe(false);
});

test.each([
  ["manager", { isManager: true, isOwner: false }],
  ["owner", { isManager: true, isOwner: true }],
])("%s opens Receiving and Case Search through Case Management", (_role, user) => {
  for (const path of ["/receiving", "/case-search"]) {
    expect(canOpen(pageForPath(path), user)).toBe(true);
    expect(navItemsFor(user).some(({ path: navPath }) => navPath === path)).toBe(false);
  }
  expect(canOpen(pageForPath("/case-management"), user)).toBe(true);
  expect(navItemsFor(user).some(({ path, label }) => path === "/case-management" && label === "Case Management")).toBe(true);
});

const managerPages = [
  "/case-management",
  "/service-types",
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
  "/case-management",
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
  expect(navPaths.indexOf("/case-management")).toBe(navPaths.indexOf("/inbox") + 1);
  expect(navPaths.indexOf("/delivery-management")).toBe(navPaths.indexOf("/case-management") + 1);
  expect(canOpen(pageForPath("/routes"), user)).toBe(true);
  for (const path of managerNavPages) {
    expect(navItemsFor(user).some(({ path: navPath }) => navPath === path)).toBe(true);
  }
  for (const path of ["/routes", "/logistics", "/drivers", "/clinics", "/receiving", "/case-search", "/service-types"]) {
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
  ["/receiving", "/case-management"],
  ["/case-search", "/case-management"],
  ["/service-types", "/case-management"],
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
  const cases = navItemsFor(user).find(({ path }) => path === "/case-management");

  expect(isNavItemActive(delivery, "/drivers-extra")).toBe(false);
  expect(isNavItemActive(tooth, "/tooth-orders-archive")).toBe(false);
  expect(isNavItemActive(cases, "/receiving-archive")).toBe(false);
});

test("only owners and managers can open and see the Inbox", () => {
  const inbox = pageForPath("/inbox");
  for (const user of [{ isManager: true, isOwner: false }, { isManager: true, isOwner: true }]) {
    expect(canOpen(inbox, user)).toBe(true);
    expect(navItemsFor(user).some(({ path }) => path === "/inbox")).toBe(true);
  }
  for (const user of [{ isManager: false, isOwner: false }, { isManager: false, isOwner: false, isDriver: true }]) {
    expect(canOpen(inbox, user)).toBe(false);
    expect(navItemsFor(user).some(({ path }) => path === "/inbox")).toBe(false);
  }
});
