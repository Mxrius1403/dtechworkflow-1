import { useData } from "@/context/DataContext";
import { BackLink } from "@/components/common/Bits";
import { useScrollToHash } from "@/hooks/use-scroll-to-hash";
import { MaterialOrderList } from "./MaterialOrderList";

export function MaterialRequests() {
  const { materialOrders } = useData();
  useScrollToHash(materialOrders.length > 0);
  return (
    <>
      <BackLink to="/materials" className="text-base">Material Management</BackLink>
      <MaterialOrderList
        manager
        title="Material Order Requests"
        description="Review material requests, download the PDF to send to the supplier, and mark handled orders as done."
        orders={materialOrders}
      />
    </>
  );
}
