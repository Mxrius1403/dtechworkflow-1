import {
  BarChart3, ClipboardList, Inbox, KeyRound, LayoutDashboard, Package, Search, Timer, TreePalm, Truck, Users,
} from "lucide-react";

const manager = (u) => u.isManager;
const technician = (u) => !u.isManager;
const always = () => true;
const materialsLabel = (u) => (u.isManager ? "Material Order Requests" : "Order TDS");

/**
 * Every staff screen in one list (order = sidebar order).
 * path: URL • label/title: text (string or fn(user)) • nav(user): show in sidebar • access(user): may open the URL.
 * Add the page component for a new path in src/App.js (SCREENS).
 */
export const PAGES = [
  { path: "/owner-control", label: "Owner Control", icon: KeyRound, access: (u) => u.isOwner, nav: (u) => u.isOwner },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, nav: always },
  { path: "/receiving", label: "Digital Receiving", title: "Receiving Station", icon: Inbox, access: (u) => u.isManager || u.department === "digital", nav: (u) => !u.isManager && u.department === "digital" },
  { path: "/other-work", label: "Other Work", icon: Timer, access: (u) => !u.isManager && u.department === "ortho", nav: (u) => !u.isManager && u.department === "ortho" },
  { path: "/logistics", label: "Deliveries & Collections", icon: Truck, access: manager, nav: manager },
  { path: "/case-search", label: "Case Search", icon: Search, access: manager, nav: manager },
  { path: "/tooth-order", label: "Tooth Order", icon: ClipboardList, access: technician, nav: technician },
  { path: "/tooth-orders", label: "Tooth Orders", icon: ClipboardList, access: manager, nav: manager },
  { path: "/materials", label: materialsLabel, icon: Package, nav: always },
  { path: "/technicians", label: "Technicians", icon: Users, access: manager, nav: manager },
  { path: "/holidays", label: "Holiday Requests", icon: TreePalm, nav: always },
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
