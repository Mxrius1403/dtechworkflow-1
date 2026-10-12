import { BackLink } from "@/components/common/Bits";
import { OrderTds } from "./OrderTds";

export default function OrderMaterialsPage() {
  return (
    <>
      <BackLink to="/materials">Material Management</BackLink>
      <OrderTds />
    </>
  );
}
