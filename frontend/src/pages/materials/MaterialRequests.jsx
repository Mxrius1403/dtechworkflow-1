import { useData } from "@/context/DataContext";
import { BackLink } from "@/components/common/Bits";
import { MaterialOrderList } from "./MaterialOrderList";

export function MaterialRequests() {
  const { materialOrders } = useData();
  return (
    <>
      <BackLink to="/materials">Material Management</BackLink>
      <MaterialOrderList
        manager
        title="Material Order Requests"
        description="Review requests submitted by technicians and download the PDF to send to Tough Dental Supplies."
        orders={materialOrders}
      />
    </>
  );
}
