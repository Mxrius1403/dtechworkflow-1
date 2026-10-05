import { useSession } from "@/context/SessionContext";
import { MaterialRequests } from "./MaterialRequests";
import { OrderTds } from "./OrderTds";

/** Technicians order TDS products; managers review the resulting requests. */
export default function MaterialsPage() {
  const { user } = useSession();
  return user.isManager ? <MaterialRequests /> : <OrderTds />;
}
