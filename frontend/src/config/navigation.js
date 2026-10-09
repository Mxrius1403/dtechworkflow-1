import {
  BarChart3, Boxes, Building2, Car, ClipboardList, Inbox, KeyRound, LayoutDashboard, MapPin, Package, Route, Search, ShoppingCart, Store, Users,
} from "lucide-react";

const manager = (u) => u.isManager || u.isOwner;
const technician = (u) => !manager(u);
const always = () => true;
const materialsLabel = (u) => (manager(u) ? "Material Management" : "Order Materials");

/**
 * Every staff screen in one list (order = sidebar order).
 * path: URL • label/title: text (string or fn(user)) • nav(user): show in sidebar • access(user): may open the URL.
 * Add the page component for a new path in src/App.js (SCREENS).
 */
export const PAGES = [
  { path: "/owner-control", label: "Ownership & Managers", icon: KeyRound, access: (u) => u.isOwner, nav: (u) => u.isOwner },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, nav: always },
  { path: "/receiving", label: "Receiving", title: "Receiving Station", icon: Inbox, access: always, nav: always },
  { path: "/routes", label: "Routes", icon: MapPin, access: always, nav: always },
  { path: "/logistics", label: "Create Route", icon: Route, access: manager, nav: manager },
  { path: "/drivers", label: "Drivers", icon: Car, access: manager, nav: manager },
  { path: "/clinics", label: "Clinics", icon: Building2, access: manager, nav: manager },
  { path: "/suppliers", label: "Suppliers", icon: Store, access: manager },
  { path: "/case-search", label: "Case Search", icon: Search, access: always, nav: always },
  { path: "/tooth-management", label: "Tooth Management", icon: ClipboardList, access: manager, nav: manager },
  { path: "/tooth-order", label: "Order Tooth", icon: ClipboardList, access: always, nav: technician },
  { path: "/tooth-orders", label: "Tooth Order Requests", icon: ClipboardList, access: manager },
  { path: "/materials/requests", label: "Material Order Requests", icon: ClipboardList, access: manager },
  { path: "/materials/products", label: "Product Management", icon: Boxes, access: manager },
  { path: "/materials/order", label: "Order Materials", icon: ShoppingCart, access: manager },
  { path: "/materials", label: materialsLabel, icon: Package, nav: always },
  { path: "/technicians", label: "Technicians", icon: Users, access: manager, nav: manager },
  { path: "/reports", label: "Reports", icon: BarChart3, access: manager, nav: manager },
  { path: "/completion-review", label: "Completion Review", access: manager },
  { path: "/attention", label: "Cases Needing Attention", access: manager },
  { path: "/calendar", label: "Production Calendar", access: manager },
];

const resolve = (value, user) => (typeof value === "function" ? value(user) : value);

export const pageForPath = (pathname) => PAGES.find((p) => pathname === p.path || pathname.startsWith(`${p.path}/`));
export const canOpen = (page, user) => Boolean(page) && (!page.access || page.access(user));
export const pageTitle = (page, user) => resolve(page?.title || page?.label, user) || "Dashboard";
export const navItemsFor = (user) => PAGES.filter((p) => p.nav?.(user)).map((p) => ({ ...p, label: resolve(p.label, user) }));
