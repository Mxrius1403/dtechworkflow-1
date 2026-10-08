import { useSession } from "@/context/SessionContext";
import AttentionPage from "@/pages/AttentionPage";
import { TechnicianDashboard } from "./TechnicianDashboard";

export default function DashboardPage() {
  const { user } = useSession();
  return user.isManager ? <AttentionPage /> : <TechnicianDashboard />;
}
