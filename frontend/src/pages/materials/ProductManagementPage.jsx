import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { BackLink } from "@/components/common/Bits";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { DataTable } from "@/components/common/DataTable";
import { Field, NativeSelect } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useData } from "@/context/DataContext";
import { createProduct, deleteProduct, fetchProducts, updateProduct } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";

const FIELDS = [
  ["refNo", "Ref. No"],
  ["title", "Title"],
  ["producer", "Producer"],
  ["unit", "Unit"],
  ["quantity", "Quantity"],
  ["measure", "Measure"],
];

const emptyProduct = () => ({
  refNo: "",
  title: "",
  producer: "",
  supplierId: "",
  unit: "",
  quantity: "",
  measure: "",
});

function ProductDialog({ product, suppliers, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => ({
    ...emptyProduct(),
    ...product,
    supplierId: product?.supplierId || "",
  }));
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async () => {
    if (FIELDS.some(([key]) => !form[key].trim()) || !form.supplierId) {
      return notifyError("Complete all product fields and select a supplier");
    }
    const payload = Object.fromEntries(
      [...FIELDS.map(([key]) => key), "supplierId"].map((key) => [key, form[key].trim()]),
    );
    setSaving(true);
    try {
      if (product) await updateProduct(product.id, payload);
      else await createProduct(payload);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      notify(product ? "Product updated" : "Product added");
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : `Could not ${product ? "update" : "add"} the product`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="product-dialog">
        <DialogHeader><DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.slice(0, 3).map(([key, label]) => (
            <Field key={key} label={label}>
              <Input value={form[key]} onChange={set(key)} data-testid={`product-${key}-input`} />
            </Field>
          ))}
          <Field label="Supplier">
            <NativeSelect value={form.supplierId} onChange={set("supplierId")} data-testid="product-supplier-input">
              <option value="" label="Select a supplier" />
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id} label={supplier.name} />)}
            </NativeSelect>
          </Field>
          {FIELDS.slice(3).map(([key, label]) => (
            <Field key={key} label={label}>
              <Input value={form[key]} onChange={set(key)} data-testid={`product-${key}-input`} />
            </Field>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid="product-cancel">Cancel</Button>
          <Button onClick={save} disabled={saving || suppliers.length === 0} data-testid="product-save">
            {saving ? "Saving…" : product ? "Save Changes" : "Add Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductManagementPage() {
  const { suppliers } = useData();
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const supplierNames = Object.fromEntries(suppliers.map((supplier) => [supplier.id, supplier.name]));

  const remove = async (productId) => {
    setDeletingId(productId);
    try {
      await deleteProduct(productId);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      notify("Product deleted");
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not delete the product");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <BackLink to="/materials">Material Management</BackLink>
      <Panel
        title="Product Management"
        description="Create and manage products and their supplier details."
        actions={(
          <Button onClick={() => setAdding(true)} disabled={suppliers.length === 0} data-testid="product-add-button">
            <Plus /> Add Product
          </Button>
        )}
      >
        {suppliers.length === 0 && (
          <p role="status" className="mb-4 rounded-md border border-border p-3 text-sm text-muted-foreground">
            Add a supplier before creating products.
          </p>
        )}
        {products.isLoading ? (
          <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-secondary" />
        ) : products.isError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 p-3 text-sm" role="alert">
            <span>Could not load products.</span>
            <Button variant="outline" size="sm" onClick={() => products.refetch()}>Retry</Button>
          </div>
        ) : (
          <DataTable
            testId="products-table"
            rows={[...products.data].sort((a, b) => String(a.refNo).localeCompare(String(b.refNo)))}
            rowTestId={(product) => `product-row-${product.id}`}
            empty="No products yet."
            columns={[
              { key: "refNo", header: "Ref. No" },
              { key: "title", header: "Title" },
              { key: "producer", header: "Producer" },
              { key: "supplierId", header: "Supplier", render: (product) => supplierNames[product.supplierId] || "Supplier unavailable" },
              { key: "unit", header: "Unit" },
              { key: "quantity", header: "Quantity" },
              { key: "measure", header: "Measure" },
              {
                key: "edit",
                header: "",
                render: (product) => (
                  <Button size="sm" variant="outline" onClick={() => setEditing(product)} data-testid={`product-edit-${product.id}`}>
                    <Pencil /> Edit
                  </Button>
                ),
              },
              {
                key: "delete",
                header: "",
                render: (product) => (
                  <ConfirmAction
                    title={`Delete ${product.title}?`}
                    description="This action cannot be undone."
                    confirmLabel="Delete Product"
                    onConfirm={() => remove(product.id)}
                    testId={`product-delete-${product.id}`}
                  >
                    <Button size="sm" variant="destructive" disabled={deletingId === product.id} data-testid={`product-delete-button-${product.id}`}>
                      <Trash2 /> Delete
                    </Button>
                  </ConfirmAction>
                ),
              },
            ]}
          />
        )}
        {adding && <ProductDialog suppliers={suppliers} onClose={() => setAdding(false)} />}
        {editing && <ProductDialog product={editing} suppliers={suppliers} onClose={() => setEditing(null)} />}
      </Panel>
    </>
  );
}
