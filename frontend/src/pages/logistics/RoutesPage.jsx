import { BackLink } from "@/components/common/Bits";
import { LogisticsStats } from "./LogisticsStats";
import { useSession } from "@/context/SessionContext";
import { DriverRoutes } from "./DriverRoutes";
import { RoutesTab } from "./RoutesTab";

export default function RoutesPage() {
  const { user } = useSession();

  if (user.isDriver) return <DriverRoutes />;

  return (
    <>
      <BackLink to="/delivery-management" className="text-base">Delivery Management</BackLink>
      <LogisticsStats />
      <RoutesTab />
    </>
  );
}
