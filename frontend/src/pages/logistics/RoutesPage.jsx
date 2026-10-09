import { useSearchParams } from "react-router-dom";
import { BackLink } from "@/components/common/Bits";
import { LogisticsStats } from "./LogisticsStats";
import { useSession } from "@/context/SessionContext";
import { DriverRoutes } from "./DriverRoutes";
import { RoutesTab } from "./RoutesTab";
import { defaultDriverDate } from "@/lib/logistics";

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

export default function RoutesPage() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const date = isDate(params.get("date")) ? params.get("date") : defaultDriverDate();

  const onDateChange = (nextDate) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set("date", nextDate);
    setParams(nextParams, { replace: true });
  };

  if (user.isDriver) return <DriverRoutes />;

  return (
    <>
      <BackLink to="/delivery-management">Delivery Management</BackLink>
      <LogisticsStats />
      <RoutesTab date={date} onDateChange={onDateChange} />
    </>
  );
}
