import { useSession } from "@/context/SessionContext";
import MaterialManagementPage from "./MaterialManagementPage";
import { OrderTds } from "./OrderTds";

/** Technicians order TDS products; managers choose a material-management area. */
export default function MaterialsPage() {
  const { user } = useSession();
  return user.isManager ? <MaterialManagementPage /> : <OrderTds />;
}
