import { BackLink, Notice } from "@/components/common/Bits";

export default function ProductManagementPage() {
  return (
    <div className="space-y-4">
      <BackLink to="/materials">Material Management</BackLink>
      <Notice testId="product-management-coming-soon">
        Product Management is not available yet. This section is ready for a future implementation.
      </Notice>
    </div>
  );
}
