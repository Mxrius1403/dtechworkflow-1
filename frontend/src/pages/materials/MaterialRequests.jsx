import { useData } from "@/context/DataContext";
import { MaterialOrderList } from "./MaterialOrderList";

export function MaterialRequests() {
  const { materialOrders } = useData();
  return (
    <MaterialOrderList
      manager
      title="Material Order Requests"
      description="Review requests submitted by technicians and download the PDF to send to Tough Dental Supplies."
      orders={materialOrders}
    />
  );
}
