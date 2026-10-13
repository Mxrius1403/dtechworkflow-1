import { BackLink } from "@/components/common/Bits";
import { OrderTds } from "./OrderTds";

export default function OrderMaterialsPage() {
  return (
    <>
      <BackLink to="/materials" className="text-base">Material Management</BackLink>
      <OrderTds />
    </>
  );
}
