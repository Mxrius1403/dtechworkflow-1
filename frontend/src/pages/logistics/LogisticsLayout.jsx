import { Outlet } from "react-router-dom";
import { useRouteDraft } from "./useRouteDraft";

export function LogisticsLayout() {
  const draft = useRouteDraft();
  return <Outlet context={draft} />;
}
