import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useData } from "@/context/DataContext";
import { BackLink } from "@/components/common/Bits";
import { MaterialOrderList } from "./MaterialOrderList";

export function MaterialRequests() {
  const { materialOrders } = useData();
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = window.setInterval(
      () => queryClient.invalidateQueries({ queryKey: ["data"] }),
      15000,
    );
    return () => window.clearInterval(refresh);
  }, [queryClient]);
  return (
    <>
      <BackLink to="/materials">Material Management</BackLink>
      <MaterialOrderList
        manager
        title="Material Order Requests"
        description="Review material requests, download the PDF to send to the supplier, and mark handled orders as done."
        orders={materialOrders}
      />
    </>
  );
}
