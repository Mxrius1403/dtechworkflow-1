import { useSession } from "@/context/SessionContext";
import { ManagerDashboard } from "./ManagerDashboard";
import { TechnicianDashboard } from "./TechnicianDashboard";

export default function DashboardPage() {
  const { user } = useSession();
  return user.isManager ? <ManagerDashboard /> : <TechnicianDashboard />;
}
