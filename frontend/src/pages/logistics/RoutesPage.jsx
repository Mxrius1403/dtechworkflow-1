import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { BackLink } from "@/components/common/Bits";
import { LogisticsStats } from "./LogisticsStats";
import { ReadyCasesPanel } from "./ReadyCasesPanel";
import { RoutesTab } from "./RoutesTab";
import { defaultDriverDate } from "@/lib/logistics";

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

export default function RoutesPage() {
  const draft = useOutletContext();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const date = isDate(params.get("date")) ? params.get("date") : defaultDriverDate();

  const onDateChange = (nextDate) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set("date", nextDate);
    setParams(nextParams, { replace: true });
  };

  return (
    <>
      <BackLink to="/delivery-management">Delivery Management</BackLink>
      <LogisticsStats />
      <ReadyCasesPanel draft={draft} onAdded={() => navigate("/logistics")} />
      <RoutesTab date={date} onDateChange={onDateChange} />
    </>
  );
}
