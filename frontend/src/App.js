import "@/App.css";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenMessage } from "@/components/common/FullScreenMessage";
import { canOpen, pageForPath } from "@/config/navigation";
import { DataProvider } from "@/context/DataContext";
import { SessionProvider, useSession } from "@/context/SessionContext";
import AttentionPage from "@/pages/AttentionPage";
import CaseSearchPage from "@/pages/CaseSearchPage";
import ClinicsPage from "@/pages/clinics/ClinicsPage";
import CompletionReviewPage from "@/pages/CompletionReviewPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import DriversPage from "@/pages/drivers/DriversPage";
import MaterialsPage from "@/pages/materials/MaterialsPage";
import OrderMaterialsPage from "@/pages/materials/OrderMaterialsPage";
import ProductManagementPage from "@/pages/materials/ProductManagementPage";
import { MaterialRequests } from "@/pages/materials/MaterialRequests";
import OwnerControlPage from "@/pages/OwnerControlPage";
import ProductionCalendarPage from "@/pages/ProductionCalendarPage";
import ReceivingPage from "@/pages/ReceivingPage";
import ReportsPage from "@/pages/reports/ReportsPage";
import SignInPage from "@/pages/SignInPage";
import SuppliersPage from "@/pages/suppliers/SuppliersPage";
import TechniciansPage from "@/pages/technicians/TechniciansPage";
import ToothOrderPage from "@/pages/tooth/ToothOrderPage";
import ToothManagementPage from "@/pages/tooth/ToothManagementPage";
import ToothOrdersPage from "@/pages/tooth/ToothOrdersPage";
import TrackingPage from "@/pages/tracking/TrackingPage";
import { LogisticsLayout } from "@/pages/logistics/LogisticsLayout";
import LogisticsPage from "@/pages/logistics/LogisticsPage";
import RoutesPage from "@/pages/logistics/RoutesPage";

// URL -> page component. Who may open each URL is defined in config/navigation.js.
const SCREENS = [
  ["/dashboard", DashboardPage],
  ["/receiving", ReceivingPage],
  ["/drivers", DriversPage],
  ["/clinics", ClinicsPage],
  ["/suppliers", SuppliersPage],
  ["/case-search", CaseSearchPage],
  ["/tooth-management", ToothManagementPage],
  ["/tooth-order", ToothOrderPage],
  ["/tooth-orders", ToothOrdersPage],
  ["/materials/requests", MaterialRequests],
  ["/materials/products", ProductManagementPage],
  ["/materials/order", OrderMaterialsPage],
  ["/materials", MaterialsPage],
  ["/technicians", TechniciansPage],
  ["/technicians/:id", TechniciansPage],
  ["/reports", ReportsPage],
  ["/completion-review", CompletionReviewPage],
  ["/attention", AttentionPage],
  ["/calendar", ProductionCalendarPage],
  ["/calendar/:date", ProductionCalendarPage],
  ["/owner-control", OwnerControlPage],
];

function StaffArea() {
  const { user } = useSession();
  return user ? <AppShell /> : <Navigate to="/" replace />;
}

function DriverArea() {
  return <Navigate to="/dashboard" replace />;
}

function ProtectedDataLayout() {
  const { user, loading, error } = useSession();
  if (loading) return <FullScreenMessage title="Dental Tech Daily" text="Checking your sign-in…" loading />;
  if (error) return <FullScreenMessage title="Sign-in unavailable" text="The authentication service could not be reached. Check the connection and retry." action={{ label: "Retry", onClick: () => window.location.reload() }} />;
  if (!user) return <Navigate to="/" replace />;
  return <DataProvider><Outlet /></DataProvider>;
}

function Guarded({ path, Page }) {
  const { user } = useSession();
  return canOpen(pageForPath(path), user) ? <Page /> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/track" element={<TrackingPage />} />
          <Route path="/" element={<SignInPage />} />
          <Route element={<ProtectedDataLayout />}>
            <Route path="/driver" element={<DriverArea />} />
            <Route element={<StaffArea />}>
              <Route element={<LogisticsLayout />}>
                <Route path="/logistics" element={<LogisticsPage />} />
                <Route path="/routes" element={<RoutesPage />} />
              </Route>
              {SCREENS.map(([path, Page]) => <Route key={path} path={path} element={<Guarded path={path} Page={Page} />} />)}
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </SessionProvider>
      <Toaster position="top-right" richColors closeButton />
    </BrowserRouter>
  );
}
