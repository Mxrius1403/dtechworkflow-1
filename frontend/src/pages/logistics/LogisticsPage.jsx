import { useNavigate, useOutletContext } from "react-router-dom";
import { LogisticsStats } from "./LogisticsStats";
import { CreateRouteTab } from "./CreateRouteTab";
import { ReadyCasesPanel } from "./ReadyCasesPanel";

export default function LogisticsPage() {
  const draft = useOutletContext();
  const navigate = useNavigate();

  return (
    <>
      <LogisticsStats />
      <CreateRouteTab
        draft={draft}
        readyCases={<ReadyCasesPanel draft={draft} onAdded={() => navigate("/logistics")} completedOnly />}
        onPublished={(date) => navigate(`/routes?date=${date}`)}
      />
    </>
  );
}
