import "@/App.css";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/AppShell";
import { canOpen, pageForPath } from "@/config/navigation";
import { DataProvider } from "@/context/DataContext";
import { SessionProvider, useSession } from "@/context/SessionContext";
import AttentionPage from "@/pages/AttentionPage";
import CaseSearchPage from "@/pages/CaseSearchPage";
import CompletionReviewPage from "@/pages/CompletionReviewPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import DriverPortalPage from "@/pages/driver/DriverPortalPage";
import HolidaysPage from "@/pages/holidays/HolidaysPage";
import LogisticsPage from "@/pages/logistics/LogisticsPage";
import MaterialsPage from "@/pages/materials/MaterialsPage";
import OtherWorkPage from "@/pages/OtherWorkPage";
import OwnerControlPage from "@/pages/OwnerControlPage";
import ProductionCalendarPage from "@/pages/ProductionCalendarPage";
import ReceivingPage from "@/pages/ReceivingPage";
import ReportsPage from "@/pages/reports/ReportsPage";
import SignInPage from "@/pages/SignInPage";
import TechniciansPage from "@/pages/technicians/TechniciansPage";
import ToothOrderPage from "@/pages/tooth/ToothOrderPage";
import ToothOrdersPage from "@/pages/tooth/ToothOrdersPage";
import TrackingPage from "@/pages/tracking/TrackingPage";

// URL -> page component. Who may open each URL is defined in config/navigation.js.
const SCREENS = [
  ["/dashboard", DashboardPage],
  ["/receiving", ReceivingPage],
  ["/other-work", OtherWorkPage],
  ["/logistics", LogisticsPage],
  ["/case-search", CaseSearchPage],
  ["/tooth-order", ToothOrderPage],
  ["/tooth-orders", ToothOrdersPage],
  ["/materials", MaterialsPage],
  ["/technicians", TechniciansPage],
  ["/technicians/:id", TechniciansPage],
  ["/holidays", HolidaysPage],
  ["/reports", ReportsPage],
  ["/completion-review", CompletionReviewPage],
  ["/attention", AttentionPage],
  ["/calendar", ProductionCalendarPage],
  ["/calendar/:date", ProductionCalendarPage],
  ["/owner-control", OwnerControlPage],
];

const DataLayout = () => (
  <DataProvider>
    <SessionProvider>
      <Outlet />
    </SessionProvider>
  </DataProvider>
);

function StaffArea() {
  const { user } = useSession();
  return user ? <AppShell /> : <Navigate to="/" replace />;
}

function DriverArea() {
  const { driver } = useSession();
  return driver ? <DriverPortalPage /> : <Navigate to="/" replace />;
}

function Guarded({ path, Page }) {
  const { user } = useSession();
  return canOpen(pageForPath(path), user) ? <Page /> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/track" element={<TrackingPage />} />
        <Route element={<DataLayout />}>
          <Route path="/" element={<SignInPage />} />
          <Route path="/driver" element={<DriverArea />} />
          <Route element={<StaffArea />}>
            {SCREENS.map(([path, Page]) => <Route key={path} path={path} element={<Guarded path={path} Page={Page} />} />)}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster position="top-right" richColors closeButton />
    </BrowserRouter>
  );
}
